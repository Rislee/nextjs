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
      padding: '24px',
      background: 'var(--black-100)'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '400px',
        background: 'var(--black-80)', /* 로그인 섹션 배경 */
        borderRadius: '16px',
        padding: '40px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '600', 
            color: 'var(--white)', 
            margin: '0 0 8px 0',
            fontFamily: 'var(--font-family)'
          }}>
            로그인
          </h1>
          <p style={{ 
            color: 'var(--text-color)', 
            fontSize: '16px', 
            margin: '0',
            fontFamily: 'var(--font-family)'
          }}>
            Inner-OS, 내면의 운영체제에 접속하세요
          </p>
        </div>

        {/* 이메일/비밀번호 로그인 */}
        <form onSubmit={onEmailSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{
              color: 'var(--white)',
              fontSize: '14px',
              fontWeight: '400',
              fontFamily: 'var(--font-family)',
              display: 'block'
            }}>
              이메일
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                background: 'var(--input-bg)',
                border: '2px solid transparent',
                borderRadius: '8px',
                padding: '16px',
                fontFamily: 'var(--font-family)',
                fontSize: '16px',
                color: 'var(--white)',
                width: '100%',
                transition: 'all 0.2s ease-in-out',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--brand-color)';
                e.target.style.background = 'var(--black-80)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'transparent';
                e.target.style.background = 'var(--input-bg)';
              }}
            />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{
              color: 'var(--white)',
              fontSize: '14px',
              fontWeight: '400',
              fontFamily: 'var(--font-family)',
              display: 'block'
            }}>
              비밀번호
            </label>
            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              style={{
                background: 'var(--input-bg)',
                border: '2px solid transparent',
                borderRadius: '8px',
                padding: '16px',
                fontFamily: 'var(--font-family)',
                fontSize: '16px',
                color: 'var(--white)',
                width: '100%',
                transition: 'all 0.2s ease-in-out',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--brand-color)';
                e.target.style.background = 'var(--black-80)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'transparent';
                e.target.style.background = 'var(--input-bg)';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--brand-color)',
              color: 'var(--black-100)',
              border: 'none',
              borderRadius: '80px',
              padding: '12px 24px',
              fontFamily: 'var(--font-family)',
              fontSize: '16px',
              fontWeight: '600', /* 세미볼드 */
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease-in-out',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              minHeight: '48px',
              width: '100%',
              opacity: loading ? 0.7 : 1
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'var(--white)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'var(--brand-color)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
          
          {err && (
            <div style={{
              color: '#ef4444',
              fontSize: '14px',
              textAlign: 'center',
              fontFamily: 'var(--font-family)'
            }}>
              {err}
            </div>
          )}
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
            background: 'rgba(255, 255, 255, 0.1)' 
          }}></div>
          <span style={{ 
            color: 'var(--text-color)', 
            fontSize: '14px',
            fontFamily: 'var(--font-family)'
          }}>
            또는
          </span>
          <div style={{ 
            flex: 1, 
            height: '1px', 
            background: 'rgba(255, 255, 255, 0.1)' 
          }}></div>
        </div>

        {/* Google 로그인 */}
        <button
          onClick={signInWithGoogle}
          style={{
            background: 'var(--black-80)',
            color: 'var(--white)',
            border: '2px solid transparent',
            borderRadius: '80px',
            padding: '12px 24px',
            fontFamily: 'var(--font-family)',
            fontSize: '16px',
            fontWeight: '400',
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start', /* 텍스트 왼쪽에 붙게 */
            gap: '12px',
            minHeight: '48px',
            width: '100%',
            marginBottom: '24px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'var(--black-60)';
            e.currentTarget.style.borderColor = 'var(--brand-color)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'var(--black-80)';
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {/* 구글 로고 좌상단에 위치 */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google로 계속하기
        </button>

        {/* 회원가입 링크 */}
        <div style={{ textAlign: 'center' }}>
          <span style={{ 
            color: 'var(--text-color)', 
            fontSize: '14px',
            fontFamily: 'var(--font-family)'
          }}>
            계정이 없으신가요?{' '}
          </span>
          <a
            href={signUpHref}
            style={{ 
              color: 'var(--white)', /* 화이트로 */
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '400',
              fontFamily: 'var(--font-family)',
              borderBottom: '1px solid var(--white)'
            }}
          >
            회원가입
          </a>
        </div>
      </div>

      <style jsx>{`
        /* 플레이스홀더 스타일 */
        input::placeholder {
          color: var(--text-color) !important;
        }
        
        /* Pretendard 폰트 로드 */
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/dist/web/static/pretendard.css');
      `}</style>
    </div>
  );
}