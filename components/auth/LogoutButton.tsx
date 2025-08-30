// components/auth/LogoutButton.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  async function onLogout() {
    if (loading) return;
    setLoading(true);
    try {
      // 1) Supabase 세션 로그아웃 (최대 1초 대기 후 계속 진행)
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((r) => setTimeout(r, 1000)),
      ]).catch(() => {});
      // 2) 서버 uid 쿠키 제거
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    } finally {
      // 3) 강제 이동 (router가 안 먹는 환경에서도 확실히 이동)
      if (typeof window !== 'undefined') {
        window.location.assign('/auth/sign-in');
      } else {
        router.replace('/auth/sign-in');
      }
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className={className ?? "rounded border px-3 py-1 text-sm hover:bg-gray-50"}
    >
      {loading ? '로그아웃 중…' : '로그아웃'}
    </button>
  );
}
