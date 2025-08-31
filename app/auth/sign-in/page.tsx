// app/auth/sign-in/page.tsx
'use client';

import { Suspense, useCallback, useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// createClient 대신 createBrowserClient 사용
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">로그인 초기화 중...</div>}>
      <Content />
    </Suspense>
  );
}

function Content() {
  const sp = useSearchParams();
  const router = useRouter();

  const next = sp.get('next') || '';
  const redirectTo = useMemo(() => {
    const base = 'https://account.inneros.co.kr/auth/callback';
    return next ? `${base}?next=${encodeURIComponent(next)}` : base;
  }, [next]);

  // 이미 로그인 상태 확인
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch('/api/me/summary', { 
          credentials: 'include',
          cache: 'no-store'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.ok && data.uid) {
            console.log('Already authenticated, redirecting to dashboard');
            const targetUrl = next || '/dashboard';
            router.replace(targetUrl);
            return;
          }
        }
      } catch (error) {
        console.log('Auth check failed:', error);
      }
    };

    checkAuthStatus();
  }, [next, router]);

  // Email/Password
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const triggerAuthChange = () => {
    // AuthStatusButton에게 상태 변화 알리기
    try {
      window.dispatchEvent(new CustomEvent('auth-status-changed'));
      localStorage.setItem('auth_changed', Date.now().toString());
      localStorage.removeItem('auth_changed');
    } catch (e) {
      // 무시
    }
  };

  const onEmailSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setErr("");

    try {
      console.log('=== Starting login process ===');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pw,
      });
      
      if (error) throw error;
      
      console.log('Supabase login success:', data.session ? 'Session created' : 'No session');

      // 세션이 생성될 때까지 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 200));

      // ensure API 호출로 uid 쿠키 동기화
      const token = data.session?.access_token || "";
      console.log('Calling /api/session/ensure with token:', token ? 'Present' : 'None');
      
      const ensureRes = await fetch('/api/session/ensure', {
        method: 'GET',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      console.log('Ensure API response:', ensureRes.status, ensureRes.ok);
      
      if (ensureRes.ok) {
        const ensureData = await ensureRes.json();
        console.log('Ensure API data:', ensureData);
        
        // 상태 변화 알리기
        triggerAuthChange();
        
        // 잠시 대기 후 이동 (상태 업데이트 시간 확보)
        setTimeout(() => {
          console.log('Redirecting to:', next || '/dashboard');
          window.location.href = next || '/dashboard';
        }, 300);
      } else {
        throw new Error('세션 동기화에 실패했습니다.');
      }
      
    } catch (e: any) {
      console.error('Login error:', e);
      setErr(e?.message || '로그인에 실패했습니다.');
      setLoading(false);
    }
  }, [email, pw, next, loading]);

  // Google OAuth
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

      {/* 이메일/비밀번호 로그인 */}
      <form onSubmit={onEmailSignIn} className="space-y-3">
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>

      <div className="text-center text-xs text-gray-500">또는</div>

      {/* Google 로그인 */}
      <button
        onClick={signInWithGoogle}
        className="w-full rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
      >
        Google로 계속하기
      </button>

      {/* 회원가입 이동 */}
      <a
        href={signUpHref}
        className="block w-full rounded-md border px-4 py-2 text-center text-sm hover:bg-gray-50"
      >
        이메일로 회원가입
      </a>
    </main>
  );
}