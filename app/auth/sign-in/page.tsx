'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">로그인 초기화 중…</div>}>
      <Content />
    </Suspense>
  );
}

function Content() {
  const sp = useSearchParams();

  // /auth/sign-in?next=/checkout/START_OS 지원
  const next = sp.get('next') || '';
  const redirectTo = useMemo(() => {
    const base = 'https://account.inneros.co.kr/auth/callback';
    return next ? `${base}?next=${encodeURIComponent(next)}` : base;
  }, [next]);

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

  const signUpHref = useMemo(
    () => (next ? `/auth/sign-up?next=${encodeURIComponent(next)}` : `/auth/sign-up`),
    [next]
  );

  return (
    <main className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-xl font-semibold">로그인</h1>

      <button
        onClick={signInWithGoogle}
        className="mt-2 w-full rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
      >
        Google로 계속하기
      </button>

      <div className="text-center text-xs text-gray-500">또는</div>

      {/* 이메일 회원가입 안내 */}
      <a
        href={signUpHref}
        className="block w-full rounded-md border px-4 py-2 text-center text-sm hover:bg-gray-50"
      >
        이메일로 회원가입
      </a>
    </main>
  );
}
