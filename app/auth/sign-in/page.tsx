// app/auth/sign-in/page.tsx
'use client';

import { Suspense, useCallback, useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="inneros-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>로그인 초기화 중...</div>
      </div>
    }>
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

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const triggerAuthChange = () => {
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

      await new Promise(resolve => setTimeout(resolve, 200));

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
        
        triggerAuthChange();
        
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
    <div className="inneros-page" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div className="inneros-card" style={{ 
        width: '100%', 
        maxWidth: '400px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '600', 
            color: 'var(--text-primary)', 
            margin: '0 0 8px 0' 
          }}>
            로그인
          </h1>
          <p style={{ 
            color: 'var(--text-secondary)', 
            fontSize: '16px', 
            margin: '0' 
          }}>
            Inner-OS, 내면의 운영체제에 접속하세요
          </p>
        </div>

        {/* 이메일/비밀번호 로그인 */}
        <form onSubmit={onEmailSignIn} className="inneros-form">
          <div className="inneros-form-group">
            <label className="inneros-label">이메일</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="inneros-input"
            />
          </div>
          
          <div className="inneros-form-group">
            <label className="inneros-label">비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              className="inneros-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inneros-button"
            style={{ width: '100%' }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
          
          {err && <div className="inneros-error">{err}</div>}
        </form>

        {/* 구분선 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          margin: '32px 0',
          gap: '16px'
        }}>
          <div style={{ 
            flex: 1, 
            height: '1px', 
            background: 'var(--border-primary)' 
          }}></div>
          <span style={{ 
            color: 'var(--text-secondary)', 
            fontSize: '14px' 
          }}>
            또는
          </span>
          <div style={{ 
            flex: 1, 
            height: '1px', 
            background: 'var(--border-primary)' 
          }}></div>
        </div>

        {/* Google 로그인 */}
        <button
          onClick={signInWithGoogle}
          className="inneros-button-secondary"
          style={{ width: '100%', marginBottom: '24px' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google로 계속하기
        </button>

        {/* 회원가입 링크 */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            계정이 없으신가요?{' '}
          </span>
          <a
            href={signUpHref}
            style={{ 
              color: 'var(--accent-color)', 
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            회원가입
          </a>
        </div>
      </div>
    </div>
  );
}