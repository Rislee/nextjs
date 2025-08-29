// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/checkout";
  const code = url.searchParams.get("code") || "";

  // 최종 리다이렉트 목적지
  const redirectTo = new URL(next, url.origin);

  // ✅ Supabase가 세션쿠키를 "이 응답(res)"에 직접 쓰도록 세팅해야 합니다.
  const res = NextResponse.redirect(redirectTo);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // Supabase가 설정하는 세션 쿠키를 응답에 실제로 기록
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // 세션 교환 실패 시 로그인 화면으로
      const fail = new URL(`/auth/sign-in?error=exchange_failed`, url.origin);
      return NextResponse.redirect(fail);
    }
  }

  // 세션 교환 후 서버가 사용자 식별 가능
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;

  // 추가로 우리 앱에서 쓰는 uid HttpOnly 쿠키도 같이 굽기
  if (uid) {
    const isProd =
      process.env.VERCEL_ENV === "production" ||
      process.env.NODE_ENV === "production";

    res.cookies.set({
      name: "uid",
      value: uid,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30일
      ...(isProd ? { domain: ".inneros.co.kr" } : {}),
    });
  }

  return res;
}
