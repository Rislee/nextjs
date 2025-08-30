// app/api/session/ensure/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ck = await cookies();

  // 응답 준비
  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return ck.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // (세션 갱신 시) Supabase 쿠키를 그대로 반영
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();
  const userId = data?.user?.id;

  if (!userId || error) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // uid HttpOnly 쿠키도 보정
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";

  res.cookies.set({
    name: "uid",
    value: userId,
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    ...(isProd ? { domain: ".inneros.co.kr" } : {}),
  });

  return res;
}
