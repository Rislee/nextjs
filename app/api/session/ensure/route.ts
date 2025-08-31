// app/api/session/ensure/route.ts - 간소화 버전
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  console.log("=== /api/session/ensure called ===");
  console.log("Host:", req.headers.get("host"));
  
  const ck = await cookies();

  // 이미 uid 쿠키가 있으면 그대로 반환 (단, 유효성 확인)
  const existingUid = ck.get("uid")?.value;
  if (existingUid && existingUid !== 'undefined' && existingUid.length > 10) {
    console.log("Valid uid cookie already exists:", existingUid.substring(0, 8) + '...');
    return NextResponse.json({ ok: true, uid: existingUid, source: 'existing_cookie' });
  }

  let uid: string | null = null;

  // 쿠키 기반 인증
  console.log("Trying cookie-based auth...");
  try {
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => {
            const value = ck.get(name)?.value;
            console.log(`Cookie get - ${name}:`, value ? "exists" : "not found");
            return value;
          },
          set: () => {
            // 응답에서 설정할 것이므로 여기서는 무시
          },
          remove: () => {
            // 응답에서 설정할 것이므로 여기서는 무시
          },
        },
      }
    );
    const { data, error } = await supa.auth.getUser();
    uid = data?.user?.id ?? null;
    console.log("Cookie auth result - uid:", uid ? uid.substring(0, 8) + '...' : null, "error:", error?.message);
  } catch (e: any) {
    console.log("Cookie auth error:", e.message);
  }

  if (!uid) {
    console.log("No uid found, returning 401");
    return NextResponse.json({ ok: false, error: "no user found" }, { status: 401 });
  }

  // uid 쿠키 설정
  const isProd = req.headers.get("host")?.includes("inneros.co.kr") || 
                 process.env.VERCEL_ENV === "production" ||
                 process.env.NODE_ENV === "production";

  console.log("Setting uid cookie for:", uid.substring(0, 8) + '...');
  console.log("isProd:", isProd);
  console.log("Host:", req.headers.get("host"));

  const response = NextResponse.json({ 
    ok: true, 
    uid, 
    source: 'session_cookie',
    cookieSet: true,
    isProd,
    host: req.headers.get("host")
  });

  // 쿠키 설정 옵션
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30일
  };

  // host-only cookie
  response.cookies.set("uid", uid, cookieOptions);
  console.log("Set host-only uid cookie with options:", cookieOptions);
  
  // domain cookie (production only)
  if (isProd) {
    const domainOptions = {
      ...cookieOptions,
      domain: ".inneros.co.kr",
    };
    response.cookies.set("uid", uid, domainOptions);
    console.log("Set domain uid cookie with options:", domainOptions);
  }

  console.log("Returning success with uid and cookies set");
  return response;
}