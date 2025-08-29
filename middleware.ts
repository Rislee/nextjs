// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PLAN_ORDER = ["FREE", "START_OS", "SIGNATURE_OS", "MASTER_OS"] as const;
type Plan = (typeof PLAN_ORDER)[number];
type Status = "active" | "past_due" | "canceled" | "none";

function toPlan(p: string | null | undefined): Plan {
  return (PLAN_ORDER as readonly string[]).includes((p || "") as any)
    ? (p as Plan)
    : "FREE";
}
function hasAccess(userPlan: Plan, required: Plan) {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(required);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const guard = [
    { prefix: "/start",     required: "START_OS" as Plan },
    { prefix: "/signature", required: "SIGNATURE_OS" as Plan },
    { prefix: "/master",    required: "MASTER_OS" as Plan },
  ].find(g => pathname.startsWith(g.prefix));

  if (!guard) return NextResponse.next();

  // uid 쿠키가 없으면 로그인으로
  const uid = req.cookies.get("uid")?.value || "";
  if (!uid) {
    const url = new URL("/auth/sign-in", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const statusUrl = new URL("/api/membership/status", req.url);
  statusUrl.searchParams.set("userId", uid);

  const res = await fetch(statusUrl.toString(), {
    method: "GET",
    headers: {
      "x-internal-key": process.env.INTERNAL_API_KEY || "",
      cookie: req.headers.get("cookie") || "",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const url = new URL("/auth/sign-in", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
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
