// app/auth/sign-in/page.tsx (요지)
"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function SignInPage() {
  const supabase = supabaseBrowser();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState("");

  async function signInWithPassword() {
  setMsg("Signing in...");
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;

    // ✅ 방금 로그인한 세션에서 access token을 꺼낸다
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error("No access token after sign-in");

    // ✅ 서버에 토큰을 보내서 uid HttpOnly 쿠키를 심게 한다
    const r = await fetch("/api/session/ensure", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error ?? "ensure failed");

    // OK → 이동
    window.location.href = "/checkout";
  } catch (e: any) {
    setMsg("ERROR: " + (e?.message ?? String(e)));
    console.error(e);
  }
}


  async function magicLink() {
    setMsg("Sending magic link...");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
      });
      if (error) throw error;
      setMsg("Magic link sent. Check your inbox.");
    } catch (e: any) {
      setMsg("ERROR: " + (e?.message ?? String(e)));
      console.error(e);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "60px auto", padding: 24, display: "grid", gap: 12 }}>
      <h1>로그인</h1>
      <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="password" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
      <button onClick={signInWithPassword}>이메일/비번 로그인</button>
      <button onClick={magicLink}>매직링크 보내기</button>
      <p style={{ whiteSpace: "pre-wrap" }}>{msg}</p>
    </main>
  );
}
