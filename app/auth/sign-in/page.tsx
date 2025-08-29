'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">로그인 페이지 로딩…</div>}>
      <SignInContent />
    </Suspense>
  );
}

function SignInContent() {
  const sp = useSearchParams();

  // 콜백으로 돌아올 주소 만들기 (next 우선, 없으면 현재 URL)
  const redirectTo = useMemo(() => {
    const next =
      sp.get('next') || (typeof window !== 'undefined' ? window.location.href : '');
    const base = 'https://account.inneros.co.kr/auth/callback';
    return next ? `${base}?next=${encodeURIComponent(next)}` : base;
  }, [sp]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }, // ✅ 반드시 memoized redirectTo 사용
    });
    if (error) {
      console.error(error);
      alert(error.message);
    }
  }, [redirectTo]);

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold">로그인</h1>

      {/* 이메일/비번 폼이 있으면 유지하고, 구글 버튼만 추가 */}
      <button
        onClick={signInWithGoogle}
        className="mt-6 w-full rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
      >
        Continue with Google
      </button>
    </main>
  );
}
