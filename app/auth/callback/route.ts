// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/dashboard";
  const code = url.searchParams.get("code") || "";

  const res = NextResponse.redirect(new URL(next, req.url));

  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          res.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: any) => {
          res.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  // 1) OAuth code → 세션 교환(sb-* 쿠키 세팅)
  if (code) {
    try {
      await supa.auth.exchangeCodeForSession(code);
    } catch (e) {
      console.error("[oauth callback] exchange error:", e);
    }
  }

  // 2) uid 쿠키도 추가(호스트/도메인 모두)
  try {
    const { data } = await supa.auth.getUser();
    const uid = data?.user?.id || "";
    const isProd =
      process.env.VERCEL_ENV === "production" ||
      process.env.NODE_ENV === "production";

    if (uid) {
      const base = {
        httpOnly: true,
        sameSite: "lax" as const,
        secure: isProd,
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      };
      // host-only
      res.cookies.set({ name: "uid", value: uid, ...base });
      // domain cookie
      if (isProd) {
        res.cookies.set({
          name: "uid",
          value: uid,
          ...base,
          domain: ".inneros.co.kr",
        });
      }
    }
  } catch (e) {
    console.error("[oauth callback] getUser error:", e);
  }

  return res;
}
