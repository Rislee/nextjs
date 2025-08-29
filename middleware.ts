// middleware.ts
import { NextResponse, NextRequest } from "next/server";

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
  const url = new URL(req.url);
  const path = url.pathname;

  // ✅ 0) 테스트/운영 공통: API는 전부 미들웨어 우회 (웹훅 포함)
  //    이 한 줄이면 /api/* 요청은 절대 이 미들웨어의 제어를 받지 않음.
  if (path.startsWith("/api")) {
    return NextResponse.next();
  }

  // (참고) 혹시 다른 정적 경로들까지 걸고 싶다면 여기에서 더 우회 조건 추가 가능:
  // if (path.startsWith("/_next") || path === "/favicon.ico") return NextResponse.next();

  // ✅ 1) 페이지 가드 대상 경로 정의
  const guards = [
    { pattern: /^\/start(\/|$)/,     required: "START_OS" as const },
    { pattern: /^\/signature(\/|$)/, required: "SIGNATURE_OS" as const },
    { pattern: /^\/master(\/|$)/,    required: "MASTER_OS" as const },
  ] as const;

  const guard = guards.find((g) => g.pattern.test(path));
  if (!guard) return NextResponse.next();

  // ✅ 2) 유저 식별 (지금 로직 그대로 유지)
  //    헤더 기반이니, 프론트/엣지 앞단에서 x-user-id를 넣지 않으면 로그인 페이지로 보냄.
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  // ✅ 3) 내부 API 호출로 플랜 조회
  //    SITE_URL은 vercel env에 꼭 세팅되어 있어야 해요(예: https://account.inneros.co.kr)
  const res = await fetch(
    `${process.env.SITE_URL}/api/membership/status?userId=${encodeURIComponent(userId)}`,
    {
      headers: { "x-internal-key": process.env.INTERNAL_API_KEY ?? "" },
      cache: "no-store",
    },
  );

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

// ✅ 4) 매처는 "페이지 경로"만 대상으로 유지
//    (/api/* 는 위에서 코드로도 우회하지만, 매처에서도 애초에 제외하는 게 가장 안전)
export const config = {
  matcher: [
    // 페이지 가드가 필요한 경로만 명시
    "/start/:path*",
    "/signature/:path*",
    "/master/:path*",

    // 또는 전역 패턴을 쓰고 싶다면(원하면 이 줄만 남기고 위 3줄 삭제):
    // "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
