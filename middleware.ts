// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host");

  // /api/* 는 항상 우회
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // 공통 쿠키 상태
  const uid = req.cookies.get("uid")?.value || "";
  const hasSb = req.cookies.getAll().some((c) => c.name.startsWith("sb-") && !!c.value);

  console.log(`[MW ${host}] ${pathname} - uid: ${uid ? uid.substring(0, 8) + '...' : 'none'}, sb: ${hasSb}`);

  // /chat/* 경로 처리
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
          
          // 다른 오류의 경우 dashboard로
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
          name: error.name,
          stack: error.stack?.split('\n')[0]
        });
        
        console.log(`[MW] API error - redirecting to dashboard`);
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    console.log(`[MW] Chat route - no specific plan check needed`);
    return NextResponse.next();
  }

  // 기타 경로들...
  if (pathname === "/auth/sign-in" || pathname === "/auth/sign-up") {
    if (uid && hasSb) {
      const next = req.nextUrl.searchParams.get("next") || "/dashboard";
      return NextResponse.redirect(new URL(next, req.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    if (!uid) {
      const signIn = new URL("/auth/sign-in", req.url);
      signIn.searchParams.set("next", pathname);
      return NextResponse.redirect(signIn);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/auth/sign-in",
    "/auth/sign-up", 
    "/dashboard/:path*",
    "/chat/:path*",
  ],
};