import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_ORDER = ["FREE","START_OS","SIGNATURE_OS","MASTER_OS"] as const;
type Plan = (typeof PLAN_ORDER)[number];
type Status = "active" | "past_due" | "canceled" | "none";

function toPlan(v: any): Plan {
  const s = String(v || "").toUpperCase();
  return s === "START_OS" || s === "SIGNATURE_OS" || s === "MASTER_OS" ? (s as Plan) : "FREE";
}
function hasAccess(userPlan: Plan, required: Plan) {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(required);
}

// 목적지 기본값 (원하면 내부 페이지로 바꿔도 됨)
const PLAN_DEFAULT_DEST: Record<Exclude<Plan,"FREE">, string> = {
  START_OS: "https://www.inneros.co.kr/start",
  SIGNATURE_OS: "https://www.inneros.co.kr/signature",
  MASTER_OS: "https://www.inneros.co.kr/master",
};

// 오픈 리다이렉트 방지용 허용 호스트
const ALLOW_HOSTS = new Set(["www.inneros.co.kr", "account.inneros.co.kr"]);

function resolveDest(required: Plan, destParam?: string | null) {
  if (destParam) {
    try {
      const u = new URL(destParam);
      if (ALLOW_HOSTS.has(u.host)) return u.toString();
    } catch {/* ignore invalid url */}
  }
  if (required === "START_OS" || required === "SIGNATURE_OS" || required === "MASTER_OS") {
    return PLAN_DEFAULT_DEST[required];
  }
  return "https://www.inneros.co.kr/";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const required = toPlan(url.searchParams.get("plan") ?? "START_OS");
  const dest = resolveDest(required, url.searchParams.get("dest"));

  // 로그인 확인 (uid 쿠키)
  const ck = await cookies();
  const uid = ck.get("uid")?.value;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://account.inneros.co.kr";

  if (!uid) {
    const signIn = new URL("/auth/sign-in", site);
    signIn.searchParams.set("next", dest);
    return NextResponse.redirect(signIn);
  }

  // 멤버십 조회
  const m = await supabaseAdmin
    .from("memberships")
    .select("plan_id,status")
    .eq("user_id", uid)
    .maybeSingle();

  if (m.error) {
    const signIn = new URL("/auth/sign-in", site);
    signIn.searchParams.set("next", dest);
    return NextResponse.redirect(signIn);
  }

  const userPlan = toPlan(m.data?.plan_id);
  const status = (m.data?.status ?? "none") as Status;

  if (status === "active" && hasAccess(userPlan, required)) {
    return NextResponse.redirect(dest);
  }

  const upgrade = new URL("/upgrade", site);
  upgrade.searchParams.set("plan", required);
  upgrade.searchParams.set("next", dest);
  return NextResponse.redirect(upgrade);
}
