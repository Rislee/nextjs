'use client';

import { useCallback, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// createClient 대신 createBrowserClient 사용
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">회원가입 초기화 중...</div>}>
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

      // 회원가입 성공 처리
      const session = data.session;
      const user = data.user;
      
      if (session && session.access_token) {
        // 세션이 있으면 (이메일 인증 꺼짐) - 바로 로그인 처리
        console.log("Session created, syncing...");
        
        // uid 쿠키 동기화
        const ensureRes = await fetch('/api/session/ensure', { 
          method: 'GET', 
          credentials: 'include',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        
        if (ensureRes.ok) {
          // 성공 - 대시보드로 이동
          window.location.href = next || '/dashboard';
        } else {
          // 동기화 실패 - 로그인 페이지로
          console.error("Session sync failed");
          setNotice("회원가입은 완료되었습니다. 로그인해주세요.");
          setTimeout(() => {
            window.location.href = `/auth/sign-in?next=${encodeURIComponent(next || '/dashboard')}`;
          }, 2000);
        }
      } else if (user) {
        // 사용자는 생성되었지만 세션이 없음 (이메일 인증 필요)
        setNotice("회원가입이 완료되었습니다. 이메일의 인증 링크를 확인해 주세요.");
      } else {
        // 예상치 못한 상황
        throw new Error("회원가입 처리 중 오류가 발생했습니다.");
      }
    } catch (err: any) {
      alert(err?.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [email, pw, fullName, next, loading]);

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold">회원가입</h1>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          type="text"
          placeholder="이름 (선택)"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
        />
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
          {loading ? '가입 중...' : '회원가입'}
        </button>
      </form>

      {notice && <p className="mt-3 text-sm text-amber-700">{notice}</p>}

      <div className="mt-4 text-xs text-gray-500">
        이미 계정이 있으신가요?{" "}
        <a
          href={next ? `/auth/sign-in?next=${encodeURIComponent(next)}` : '/auth/sign-in'}
          className="underline"
        >
          로그인
        </a>
      </div>
    </main>
  );
}