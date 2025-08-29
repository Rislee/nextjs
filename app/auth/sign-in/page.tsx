'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignInPage() {
  const sp = useSearchParams();

  // 현재 페이지로 다시 돌아오기 위해 next 파라미터 반영
  const redirectTo = useMemo(() => {
    // 브라우저의 전체 URL을 next로 넘겨주면, 로그인 후 그 위치로 복귀
    const next = sp.get('next') || (typeof window !== 'undefined' ? window.location.href : '');
    const base = 'https://account.inneros.co.kr/auth/callback';
    return next ? `${base}?next=${encodeURIComponent(next)}` : base;
  }, [sp]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) {
      console.error(error);
      alert(error.message);
    }
  }, [redirectTo]);

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold">로그인</h1>

      {/* 이메일/비번 폼이 따로 있다면 아래 버튼과 함께 유지 */}
      <button
        onClick={signInWithGoogle}
        className="mt-6 w-full rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
      >
        Continue with Google
      </button>
    </main>
  );
}
