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

  const redirectTo = useMemo(() => {
    const next = sp.get('next') || (typeof window !== 'undefined' ? window.location.href : '');
    const base = 'https://account.inneros.co.kr/auth/callback';
    return next ? `${base}?next=${encodeURIComponent(next)}` : base;
  }, [sp]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }, // ✅ 여기!
    });
    if (error) {
      console.error(error);
      alert(error.message);
    }
  }, [redirectTo]);

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold">로그인</h1>
      <button
        onClick={signInWithGoogle}
        className="mt-6 w-full rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
      >
        Continue with Google
      </button>
    </main>
  );
}
