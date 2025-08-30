// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/dashboard";
  const code = url.searchParams.get("code") || ""; // ⬅️ code 명시적으로 받기

  const res = NextResponse.redirect(new URL(next, req.url));

  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Next Response에 쿠키를 다시 써주는 어댑터
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

  // OAuth code → 세션 교환 (sb-* 쿠키 설정)
  if (code) {
    try {
      await supa.auth.exchangeCodeForSession(code); // ⬅️ code 전달
    } catch (e) {
      // code가 유효하지 않거나 재사용된 경우에도 다음 단계로 진행(리다이렉트)
      console.error("[oauth callback] exchange error:", e);
    }
  }

  // uid 쿠키도 설정
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
      // domain cookie (.inneros.co.kr)
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
    // uid 쿠키 없이도 리다이렉트는 진행 (미들웨어/ensure에서 재보정)
  }

  return res;
}
