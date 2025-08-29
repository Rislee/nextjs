// app/api/session/ensure/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set() {/* no-op */},
        remove() {/* no-op */},
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id;
  if (!uid) {
    return NextResponse.json({ ok: false, error: "no session" }, { status: 401 });
  }

  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";

  const res = NextResponse.json({ ok: true, uid });
  // uid 쿠키가 없었을 수도 있으니 보정 세팅
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
  return res;
}
