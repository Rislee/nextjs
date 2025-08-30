// app/api/auth/clear/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
  const ck = await cookies();
  const allCookies = ck.getAll();
  
  const isProd = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ 
    ok: true, 
    cleared: allCookies.length 
  });
  
  // 모든 쿠키 삭제
  for (const cookie of allCookies) {
    // host-only 쿠키 삭제
    res.cookies.set({
      name: cookie.name,
      value: "",
      path: "/",
      maxAge: 0,
    });
    
    // 도메인 쿠키도 삭제 시도
    if (isProd) {
      res.cookies.set({
        name: cookie.name,
        value: "",
        path: "/",
        domain: ".inneros.co.kr",
        maxAge: 0,
      });
    }
  }
  
  return res;
}

export async function GET() {
  return NextResponse.json({ 
    message: "Use POST method to clear cookies" 
  });
}