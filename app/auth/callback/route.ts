// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/checkout";
  const code = url.searchParams.get("code") || "";   // ✅ OAuth code

  const supabase = supabaseServer();

  // ✅ 1) OAuth code → 서버 세션으로 교환 (쿠키에 세션 심어줌)
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  // ✅ 2) 이제 서버가 사용자 조회 가능
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;

  // ✅ 3) uid HttpOnly 쿠키 굽기
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";

  const res = NextResponse.redirect(new URL(next, url.origin));

  if (uid) {
    res.cookies.set({
      name: "uid",
      value: uid,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      ...(isProd ? { domain: ".inneros.co.kr" } : {}), // prod에서만 도메인 고정
    });
  }

  return res;
}
