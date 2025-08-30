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

const GUARDS: Array<{ prefix: string; required: Plan }> = [
  { prefix: "/start", required: "START_OS" },
  { prefix: "/signature", required: "SIGNATURE_OS" },
  { prefix: "/master", required: "MASTER_OS" },
];

export async function middleware(req: NextRequest) {
  // /api/* 는 항상 우회
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  const guard = GUARDS.find(g => req.nextUrl.pathname.startsWith(g.prefix));
  if (!guard) return NextResponse.next();

  // 현재 사용자 멤버십 조회(서버 API)
  const res = await fetch(new URL("/api/membership/status", req.url), {
    headers: { Cookie: req.headers.get("cookie") || "" },
    cache: "no-store",
  });

  if (!res.ok) {
    const signIn = new URL("/auth/sign-in", req.url); // ✅ 경로 교정
    signIn.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }

  const json = (await res.json()) as { plan?: string; status?: string };
  const plan = toPlan(json.plan);
  const status = (json.status ?? "none") as Status;

  const allowed = status === "active" && hasAccess(plan, guard.required);
  if (!allowed) {
    const up = new URL("/upgrade", req.url);
    return NextResponse.redirect(up);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/start/:path*",
    "/signature/:path*",
    "/master/:path*",
  ],
};
