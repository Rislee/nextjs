import { NextResponse, NextRequest } from "next/server";

// 1) 플랜 유니온 타입
const PLAN_ORDER = ["FREE", "START_OS", "SIGNATURE_OS", "MASTER_OS"] as const;
type Plan = (typeof PLAN_ORDER)[number];
type Status = "active" | "past_due" | "canceled" | "none";

// 2) 런타임 검증: string -> Plan
function toPlan(p: string | null | undefined): Plan {
  return (PLAN_ORDER as readonly string[]).includes(p as string)
    ? (p as Plan)
    : "FREE";
}

function hasAccess(userPlan: Plan, required: Plan) {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(required);
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  // 3) guards를 리터럴로 고정(as const)
  const guards = [
    { pattern: /^\/start(\/|$)/,     required: "START_OS" as const },
    { pattern: /^\/signature(\/|$)/, required: "SIGNATURE_OS" as const },
    { pattern: /^\/master(\/|$)/,    required: "MASTER_OS" as const },
  ] as const;

  const guard = guards.find((g) => g.pattern.test(path));
  if (!guard) return NextResponse.next();

  // 🔑 임시: 헤더에서 userId 받기
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.redirect(`${process.env.SITE_URL}/signin`);

  const res = await fetch(
    `${process.env.SITE_URL}/api/membership/status?userId=${userId}`,
    { headers: { "x-internal-key": process.env.INTERNAL_API_KEY! } }
  );

  if (!res.ok) return NextResponse.redirect(`${process.env.SITE_URL}/signin`);

  // 4) 응답 타입을 안전하게 변환
  const json = (await res.json()) as { plan?: string; status?: string };
  const plan = toPlan(json.plan);
  const status = (json.status ?? "none") as Status;

  const allowed = status === "active" && hasAccess(plan, guard.required);
  if (!allowed) return NextResponse.redirect(`${process.env.SITE_URL}/upgrade`);

  return NextResponse.next();
}

export const config = {
  matcher: ["/start/:path*", "/signature/:path*", "/master/:path*"],
};
