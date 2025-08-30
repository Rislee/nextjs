import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

export async function POST() {
  const ck = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  
  // Supabase 로그아웃 시도
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => ck.get(name)?.value,
          set() {},
          remove() {},
        },
      }
    );
    await supabase.auth.signOut();
  } catch (e) {
    console.error("Supabase signOut error:", e);
  }
  
  const res = NextResponse.json({ ok: true });
  
  // 모든 관련 쿠키 삭제
  const allCookies = ck.getAll();
  
  for (const cookie of allCookies) {
    // uid 쿠키나 sb- 쿠키만 삭제
    if (cookie.name === "uid" || cookie.name.startsWith("sb-")) {
      // host-only 삭제
      res.cookies.set({
        name: cookie.name,
        value: "",
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        maxAge: 0,
      });
      
      // 도메인 쿠키 삭제 (production)
      if (isProd && cookie.name === "uid") {
        res.cookies.set({
          name: "uid",
          value: "",
          path: "/",
          domain: ".inneros.co.kr",
          httpOnly: true,
          sameSite: "lax",
          secure: true,
          maxAge: 0,
        });
      }
    }
  }
  
  return res;
}