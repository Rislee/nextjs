'use client';

import { useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function SignUpPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  async function syncUidCookie() {
    const session = await supabase.auth.getSession();
    const access = session.data.session?.access_token;
    if (!access) return;
    await fetch('/api/auth/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}` },
      credentials: 'include',
    });
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: { data: { full_name: name } },
      });
      if (error) throw error;

      // 이메일 확인 요구 ON인 프로젝트면 data.user가 null일 수 있음
      if (data.user) {
        // profiles upsert
        await supabase.from('profiles').upsert({ id: data.user.id, full_name: name });
        await syncUidCookie();
        setMsg('가입 완료! 대시보드로 이동해 주세요.');
      } else {
        setMsg('가입 이메일이 발송되었습니다. 메일을 확인해 주세요.');
      }
    } catch (e: any) {
      setMsg(e.message || '가입 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold mb-4">회원가입</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="email"
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          type="password"
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="new-password"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          {loading ? '처리 중…' : '가입하기'}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm text-gray-600">{msg}</p>}
    </main>
  );
}
