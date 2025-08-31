// middleware.ts - 리다이렉트 루프 수정
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host");

  // /api/* 는 항상 우회
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 정적 파일들 우회
  if (pathname.startsWith("/_next/") || 
      pathname.startsWith("/favicon") ||
      pathname.includes(".")) {
    return NextResponse.next();
  }

  // 공통 쿠키 상태
  const uid = req.cookies.get("uid")?.value || "";
  const hasSb = req.cookies.getAll().some((c) => c.name.startsWith("sb-") && !!c.value);

  console.log(`[MW ${host}] ${pathname} - uid: ${uid ? uid.substring(0, 8) + '...' : 'none'}, sb: ${hasSb}`);

  // 1) 로그인/회원가입 화면
  if (pathname === "/auth/sign-in" || pathname === "/auth/sign-up") {
    if (uid && hasSb) {
      const next = req.nextUrl.searchParams.get("next") || "/dashboard";
      console.log(`[MW] Already authenticated, redirecting to: ${next}`);
      return NextResponse.redirect(new URL(next, req.url));
    }
    return NextResponse.next();
  }

  // 2) 대시보드
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    if (!uid) {
      console.log(`[MW] Dashboard access without uid, redirecting to sign-in`);
      const signIn = new URL("/auth/sign-in", req.url);
      signIn.searchParams.set("next", pathname);
      return NextResponse.redirect(signIn);
    }
    return NextResponse.next();
  }

  // 3) /chat/* 경로 처리
  if (pathname.startsWith("/chat/")) {
    console.log(`[MW] Chat route detected: ${pathname}`);
    
    if (!uid) {
      console.log(`[MW] No uid for /chat/* - redirecting to sign-in`);
      const signIn = new URL("/auth/sign-in", req.url);
      signIn.searchParams.set("next", pathname);
      return NextResponse.redirect(signIn);
    }

    // /chat/start-os -> START_OS 권한 확인
    const planFromPath = pathname.split('/')[2]; // start-os
    console.log(`[MW] Plan from path: ${planFromPath}`);
    
    if (planFromPath && (planFromPath === "start-os" || planFromPath === "signature-os" || planFromPath === "master-os")) {
      const planId = planFromPath.toUpperCase().replace('-', '_'); // START_OS
      console.log(`[MW] Checking ${planId} access for user ${uid.substring(0, 8)}...`);
      
      // API로 사용자 플랜 확인
      try {
        const apiUrl = new URL("/api/me/summary", req.url);
        console.log(`[MW] Calling API: ${apiUrl.toString()}`);
        
        const res = await fetch(apiUrl.toString(), {
          headers: { 
            cookie: req.headers.get("cookie") || "",
            "user-agent": req.headers.get("user-agent") || ""
          },
          cache: "no-store",
        });

        console.log(`[MW] API response: ${res.status} ${res.statusText}`);

        if (!res.ok) {
          console.log(`[MW] API call failed: ${res.status}`);
          
          if (res.status === 401) {
            console.log(`[MW] Unauthorized - redirecting to sign-in`);
            const signIn = new URL("/auth/sign-in", req.url);
            signIn.searchParams.set("next", pathname);
            return NextResponse.redirect(signIn);
          }
          
          console.log(`[MW] Other API error - redirecting to dashboard`);
          return NextResponse.redirect(new URL("/dashboard", req.url));
        }

        const json = await res.json();
        console.log(`[MW] API response data:`, {
          ok: json.ok,
          uid: json.uid ? json.uid.substring(0, 8) + '...' : null,
          activePlansCount: json.activePlans?.length || 0,
          activePlans: json.activePlans?.map((p: any) => p.plan_id) || []
        });

        const activePlans = json?.activePlans || [];
        const hasRequiredPlan = activePlans.some((plan: any) => plan.plan_id === planId);

        console.log(`[MW] User active plans:`, activePlans.map((p: any) => p.plan_id));
        console.log(`[MW] Has ${planId}:`, hasRequiredPlan);

        if (!hasRequiredPlan) {
          console.log(`[MW] Access denied for ${planId} - redirecting to checkout`);
          const checkout = new URL(`/checkout/${planId}`, req.url);
          return NextResponse.redirect(checkout);
        }

        console.log(`[MW] Access granted for ${planId} - proceeding`);
        return NextResponse.next();
        
      } catch (error: any) {
        console.error(`[MW] Error checking plans:`, {
          message: error.message,
          name: error.name
        });
        
        console.log(`[MW] API error - redirecting to dashboard`);
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  }

  // 4) 레거시 플랜 경로들 (/start-os, /signature-os, /master-os)
  // 이 경로들은 /chat/* 로 리다이렉트
  if (pathname === "/start-os") {
    console.log(`[MW] Legacy /start-os -> redirecting to /chat/start-os`);
    return NextResponse.redirect(new URL("/chat/start-os", req.url));
  }
  
  if (pathname === "/signature-os") {
    console.log(`[MW] Legacy /signature-os -> redirecting to /chat/signature-os`);
    return NextResponse.redirect(new URL("/chat/signature-os", req.url));
  }
  
  if (pathname === "/master-os") {
    console.log(`[MW] Legacy /master-os -> redirecting to /chat/master-os`);
    return NextResponse.redirect(new URL("/chat/master-os", req.url));
  }

  // 5) 기타 보호된 경로들
  if (pathname.startsWith("/admin/")) {
    if (!uid) {
      console.log(`[MW] Admin access without uid, redirecting to sign-in`);
      const signIn = new URL("/auth/sign-in", req.url);
      signIn.searchParams.set("next", pathname);
      return NextResponse.redirect(signIn);
    }
    return NextResponse.next();
  }

  console.log(`[MW] Unmatched route, proceeding: ${pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 모든 request paths를 매치하되 다음 항목들은 제외:
     * - api (API routes)
     * - _next/static (static files) 
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};