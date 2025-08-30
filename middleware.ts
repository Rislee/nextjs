// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// 플랜 레벨 정의
const PLAN_ORDER = ["FREE", "START_OS", "SIGNATURE_OS", "MASTER_OS"] as const;
type Plan = (typeof PLAN_ORDER)[number];
type Status = "active" | "past_due" | "canceled" | "none";

function toPlan(p: string | null | undefined): Plan {
  return (PLAN_ORDER as readonly string[]).includes(p as string)
    ? (p as Plan)
    : "FREE";
}
function hasAccess(userPlan: Plan, required: Plan) {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(required);
}

// 플랜 게이트 경로
const GUARDS: Array<{ prefix: string; required: Plan }> = [
  { prefix: "/start", required: "START_OS" },
  { prefix: "/signature", required: "SIGNATURE_OS" },
  { prefix: "/master", required: "MASTER_OS" },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 0) /api/* 는 항상 우회
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // 공통 쿠키 상태
  const uid = req.cookies.get("uid")?.value || "";
  const hasSb = req.cookies.getAll().some((c) => c.name.startsWith("sb-") && !!c.value);

  // 1) 로그인/회원가입 화면: "진짜 로그인 상태( uid + sb-* )"면 우회
  if (pathname === "/auth/sign-in" || pathname === "/auth/sign-up") {
    if (uid && hasSb) {
      const next = req.nextUrl.searchParams.get("next") || "/dashboard";
      return NextResponse.redirect(new URL(next, req.url));
    }
    return NextResponse.next();
  }

  // 2) /dashboard 는 "로그인만" 필요
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    if (!uid) {
      const signIn = new URL("/auth/sign-in", req.url);
      signIn.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(signIn);
    }
    return NextResponse.next();
  }

  // 3) /admin/* 경로는 로그인 필요 (관리자 체크는 페이지에서 수행)
  if (pathname.startsWith("/admin/")) {
    if (!uid) {
      const signIn = new URL("/auth/sign-in", req.url);
      signIn.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(signIn);
    }
    return NextResponse.next();
  }

  // 4) 플랜 게이트(/start|/signature|/master)
  const guard = GUARDS.find((g) => pathname === g.prefix || pathname.startsWith(`${g.prefix}/`));
  if (guard) {
    if (!uid) {
      const signIn = new URL("/auth/sign-in", req.url);
      signIn.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(signIn);
    }

    // A안 요약 API 사용: /api/me/summary
    const apiUrl = new URL("/api/me/summary", req.url);
    const res = await fetch(apiUrl.toString(), {
      headers: { cookie: req.headers.get("cookie") || "" },
      cache: "no-store",
    });

    if (!res.ok) {
      // 요약 API가 401/에러면 로그인 요구
      const signIn = new URL("/auth/sign-in", req.url);
      signIn.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(signIn);
    }

    const json = await res.json();
    const membership = json?.membership || null;
    const plan = toPlan(membership?.plan_id);
    const status = (membership?.status ?? "none") as Status;

    const allowed = status === "active" && hasAccess(plan, guard.required);
    if (!allowed) {
      // 권한 부족 → 업그레이드로
      return NextResponse.redirect(new URL("/upgrade", req.url));
    }
  }

  // 5) 나머지 경로는 통과
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/auth/sign-in",
    "/auth/sign-up",
    "/dashboard/:path*",
    "/admin/:path*",
    "/start/:path*",
    "/signature/:path*",
    "/master/:path*",
  ],
};