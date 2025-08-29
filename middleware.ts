// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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

export async function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // ✅ /api, 정적 리소스 우회 (웹훅 포함)
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // ✅ 페이지 가드
  const guards = [
    { pattern: /^\/start(\/|$)/,     required: "START_OS" as const },
    { pattern: /^\/signature(\/|$)/, required: "SIGNATURE_OS" as const },
    { pattern: /^\/master(\/|$)/,    required: "MASTER_OS" as const },
  ] as const;

  const guard = guards.find((g) => g.pattern.test(pathname));
  if (!guard) return NextResponse.next();

  // ✅ uid 쿠키로 로그인 판별
  const uid = req.cookies.get("uid")?.value;
  if (!uid) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  // ✅ 동일 오리진으로 status 조회 (쿠키 전달)
  const res = await fetch(`${origin}/api/membership/status`, {
    headers: { Cookie: req.headers.get("cookie") || "" },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  const json = (await res.json()) as { plan?: string; status?: string };
  const plan = toPlan(json.plan);
  const status = (json.status ?? "none") as Status;

  const allowed = status === "active" && hasAccess(plan, guard.required);
  if (!allowed) {
    return NextResponse.redirect(new URL("/upgrade", req.url));
  }

  return NextResponse.next();
}

// ✅ 매처는 "페이지 경로"만 대상으로
export const config = {
  matcher: [
    "/start/:path*",
    "/signature/:path*",
    "/master/:path*",
    // 전역 가드를 쓰고 싶다면 아래 한 줄만 사용:
    // "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
