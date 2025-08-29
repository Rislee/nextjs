'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">로그인 초기화 중…</div>}>
      <Content />
    </Suspense>
  );
}

function Content() {
  const sp = useSearchParams();

  // ✅ 브라우저 전용 클라이언트 (쿠키/리다이렉트 호환성 ↑)
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // /auth/sign-in?next=/checkout/START_OS 지원
  const next = sp.get('next') || '';

  // ✅ 하드코드 금지: 현재 호스트 기준으로 콜백 URL 생성 (프리뷰/시크릿 호환)
  const redirectTo = useMemo(() => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://account.inneros.co.kr';
    const base = new URL('/auth/callback', origin).toString();
    return next ? `${base}?next=${encodeURIComponent(next)}` : base;
  }, [next]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        // 선택: 계정 고르기 강제(테스트 편의)
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      console.error('[OAuth error]', error);
      alert(error.message);
    }
  }, [redirectTo, supabase]);

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold">로그인</h1>

      <button
        onClick={signInWithGoogle}
        className="mt-6 w-full rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
      >
        Continue with Google
      </button>

      {/* 디버깅용 (원인 추적에 도움) */}
      <p className="mt-3 text-xs text-gray-500 break-all">
        redirectTo: {redirectTo}
      </p>
      {next ? (
        <p className="mt-1 text-xs text-gray-500">next: {next}</p>
      ) : null}
    </main>
  );
}
