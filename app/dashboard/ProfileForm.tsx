'use client';

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function ProfileForm() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: u }, { data: prof }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("profiles").select("full_name").single(),
      ]);
      setEmail(u.user?.email || "");
      setFullName((prof as any)?.full_name || "");
    })();
  }, [supabase]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const { data: u, error: uerr } = await supabase.auth.getUser();
      if (uerr || !u.user) throw uerr || new Error("no user");

      // 이름 업데이트 (profiles RLS)
      await supabase.from("profiles").upsert({ id: u.user.id, full_name: fullName });

      // 이메일 변경(선택): Supabase가 확인 메일을 보낼 수 있음
      if (email && email !== u.user.email) {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw error;
      }

      // 비밀번호 변경(선택)
      if (pw) {
        const { error } = await supabase.auth.updateUser({ password: pw });
        if (error) throw error;
        setPw("");
      }

      setMsg("저장되었습니다.");
    } catch (e: any) {
      setMsg(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveProfile} className="mt-3 grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-1">
        <label className="block text-xs text-gray-500 mb-1">이름</label>
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="홍길동"
        />
      </div>
      <div className="sm:col-span-1">
        <label className="block text-xs text-gray-500 mb-1">이메일</label>
        <input
          type="email"
          className="w-full rounded border px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>
      <div className="sm:col-span-1">
        <label className="block text-xs text-gray-500 mb-1">비밀번호 변경(선택)</label>
        <input
          type="password"
          className="w-full rounded border px-3 py-2 text-sm"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="새 비밀번호"
          autoComplete="new-password"
        />
      </div>
      <div className="sm:col-span-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
        {msg && <span className="text-xs text-gray-600">{msg}</span>}
      </div>
    </form>
  );
}
