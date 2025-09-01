// app/auth/sign-up/page.tsx
'use client';

import { useCallback, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="inneros-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>회원가입 초기화 중...</div>
      </div>
    }>
      <Content />
    </Suspense>
  );
}

function Content() {
  const sp = useSearchParams();

  const next = sp.get('next') || '';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string>("");

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setNotice("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: {
          data: { full_name: fullName || null },
          emailRedirectTo: 'https://account.inneros.co.kr/auth/callback',
        },
      });

      if (error) throw error;

      const session = data.session;
      const user = data.user;
      
      if (session && session.access_token) {
        console.log("Session created, syncing...");
        
        const ensureRes = await fetch('/api/session/ensure', { 
          method: 'GET', 
          credentials: 'include',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        
        if (ensureRes.ok) {
          window.location.href = next || '/dashboard';
        } else {
          console.error("Session sync failed");
          setNotice("회원가입은 완료되었습니다. 로그인해주세요.");
          setTimeout(() => {
            window.location.href = `/auth/sign-in?next=${encodeURIComponent(next || '/dashboard')}`;
          }, 2000);
        }
      } else if (user) {
        setNotice("회원가입이 완료되었습니다. 이메일의 인증 링크를 확인해 주세요.");
      } else {
        throw new Error("회원가입 처리 중 오류가 발생했습니다.");
      }
    } catch (err: any) {
      setNotice(err?.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [email, pw, fullName, next, loading]);

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
            회원가입
          </h1>
          <p style={{ 
            color: 'var(--text-secondary)', 
            fontSize: '16px', 
            margin: '0' 
          }}>
            새로운 운영체제를 시작해보세요
          </p>
        </div>

        <form onSubmit={onSubmit} className="inneros-form">
          <div className="inneros-form-group">
            <label className="inneros-label">이름 (선택사항)</label>
            <input
              type="text"
              placeholder="홍길동"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="inneros-input"
            />
          </div>

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
              placeholder="안전한 비밀번호를 입력하세요"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              className="inneros-input"
            />
            <div style={{ 
              fontSize: '12px', 
              color: 'var(--text-muted)', 
              marginTop: '4px' 
            }}>
              최소 8자 이상의 비밀번호를 사용하세요
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inneros-button"
            style={{ width: '100%' }}
          >
            {loading ? '가입 처리 중...' : '계정 만들기'}
          </button>
        </form>

        {notice && (
          <div className={notice.includes('완료') || notice.includes('확인') ? 'inneros-success' : 'inneros-error'}>
            {notice}
          </div>
        )}

        {/* 약관 동의 */}
        <div style={{ 
          textAlign: 'center', 
          fontSize: '12px', 
          color: 'var(--text-muted)', 
          marginTop: '24px',
          lineHeight: '1.5'
        }}>
          가입하시면 InnerOS의{' '}
          <a href="https://www.inneros.co.kr/terms" style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>
            서비스 약관
          </a>과{' '}
          <a href="https://www.inneros.co.kr/privacy" style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>
            개인정보 처리방침
          </a>에 동의하는 것으로 간주됩니다.
        </div>

        {/* 로그인 링크 */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            이미 계정이 있으신가요?{' '}
          </span>
          <a
            href={next ? `/auth/sign-in?next=${encodeURIComponent(next)}` : '/auth/sign-in'}
            style={{ 
              color: 'var(--accent-color)', 
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            로그인
          </a>
        </div>
      </div>
    </div>
  );
}