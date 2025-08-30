'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  const router = useRouter();

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const next = sp.get('next') || '/dashboard';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://account.inneros.co.kr';
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  // email/password
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);

  const syncUidCookie = useCallback(async () => {
    const session = await supabase.auth.getSession();
    const access = session.data.session?.access_token;
    if (!access) return;
    await fetch('/api/auth/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}` },
      credentials: 'include',
    });
  }, [supabase]);

  const signInWithPassword = useCallback(async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      await syncUidCookie();          // 서버 uid 쿠키 동기화
      router.replace(next);
    } catch (e: any) {
      alert(e.message || '로그인 실패');
    } finally {
      setLoading(false);
    }
  }, [email, pw, supabase, next, router, syncUidCookie]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, queryParams: { prompt: 'select_account' } },
    });
    if (error) {
      console.error('[OAuth error]', error);
      alert(error.message);
    }
  }, [redirectTo, supabase]);

  return (
    <main className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-xl font-semibold">로그인</h1>

      <div className="space-y-2">
        <input
          type="email"
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          type="password"
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="current-password"
        />
        <button
          onClick={signInWithPassword}
          disabled={loading}
          className="w-full rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          {loading ? '로그인 중…' : '이메일로 로그인'}
        </button>
      </div>

      <div className="text-center text-xs text-gray-400">또는</div>

      <button
        onClick={signInWithGoogle}
        className="w-full rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
      >
        Google로 계속
      </button>

      <p className="text-xs text-gray-500 break-all">redirectTo: {redirectTo}</p>
    </main>
  );
}
