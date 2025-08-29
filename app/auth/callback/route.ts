// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  // Supabase 세션에서 유저 확인
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;

  // next 파라미터(예: /auth/callback?next=/checkout/START_OS) 지원
  const url = new URL(req.url);
  const next = url.searchParams.get("next");
  const fallback = "/checkout"; // next 없으면 기본 이동

  const isProd =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  // 기본 리다이렉트 응답 준비
  const redirectTarget = next ? new URL(next, url.origin) : new URL(fallback, url.origin);
  const res = NextResponse.redirect(redirectTarget);

  // uid 쿠키 심기
  if (uid) {
    res.cookies.set({
      name: "uid",
      value: uid,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30d
      ...(isProd ? { domain: ".inneros.co.kr" } : {}),
    });
  }

  return res;
}
