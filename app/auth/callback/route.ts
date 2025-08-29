import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer"; // 서버용 클라 (cookies 연동)

export async function GET(req: NextRequest) {
  // 구글 → Supabase → 우리 서비스로 되돌아온 상태.
  // Supabase 세션 쿠키가 있으면 getUser로 식별 가능.
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;

  const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  const res = NextResponse.redirect(new URL("/checkout", req.url));

  if (uid) {
    res.cookies.set({
      name: "uid",
      value: uid,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      ...(isProd ? { domain: ".inneros.co.kr" } : {}),
    });
  }
  return res;
}
