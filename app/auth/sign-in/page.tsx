"use client";

import { useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
// (이미 클라이언트 supabase 헬퍼가 있다면 그걸 import 하세요)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SignInPage() {
  const signInWithGoogle = useCallback(async () => {
    // ✅ 여기서 OAuth 시작 (버튼 클릭 시)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "https://account.inneros.co.kr/auth/callback",
        // oneTap: true, // 필요하면 origins 셋업 후 사용
      },
    });
    if (error) {
      console.error(error);
      alert(error.message);
    }
    // 이 함수는 곧바로 구글로 리다이렉트되므로 이후 코드는 보통 실행되지 않음
  }, []);

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold">로그인</h1>

      {/* 기존 이메일/비번 폼이 있으면 그대로 두고, 아래 버튼만 추가 */}
      <button
        onClick={signInWithGoogle}
        className="mt-6 w-full rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
      >
        Continue with Google
      </button>
    </main>
  );
}
