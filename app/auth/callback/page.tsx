// app/auth/callback/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const next = sp.get('next') || '/checkout';

        // 1) code flow 우선
        const code = sp.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          // 2) hash(implicit) fall-back 처리
          const hash = url.hash.startsWith('#') ? url.hash.slice(1) : '';
          const hp = new URLSearchParams(hash);
          const access_token = hp.get('access_token');
          const refresh_token = hp.get('refresh_token');
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
          }
        }

        // 서버에 uid HttpOnly 쿠키 심기
        await fetch('/api/session/ensure', { method: 'POST', credentials: 'include' });

        // 원래 가려던 곳으로 이동
        router.replace(next);
      } catch (e) {
        console.error(e);
        router.replace('/auth/sign-in?next=' + encodeURIComponent(sp.get('next') || '/checkout'));
      }
    })();
  }, [router, sp]);

  return <div className="p-6 text-sm text-gray-600">로그인 처리 중…</div>;
}
