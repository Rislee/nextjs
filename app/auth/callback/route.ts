// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;

  const url = new URL(req.url);
  const next = url.searchParams.get("next");
  const fallback = "/checkout";

  const isProd =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  const redirectTarget = next ? new URL(next, url.origin) : new URL(fallback, url.origin);
  const res = NextResponse.redirect(redirectTarget);

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
