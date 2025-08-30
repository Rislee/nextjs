// app/go/[plan]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PLAN_TO_FRAMER_URL, hasAccessOrHigher, type PlanId } from "@/lib/plan";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { plan: string } }
) {
  const plan = params.plan as PlanId;
  const targetUrl = PLAN_TO_FRAMER_URL[plan];
  
  if (!targetUrl) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 1. 로그인 체크
  const ck = await cookies();
  const uid = ck.get("uid")?.value;
  
  if (!uid) {
    const signIn = new URL("/auth/sign-in", req.url);
    signIn.searchParams.set("next", `/go/${plan}`);
    return NextResponse.redirect(signIn);
  }

  // 2. 멤버십 체크
  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("plan_id, status")
    .eq("user_id", uid)
    .maybeSingle();

  if (!membership || membership.status !== "active") {
    // 멤버십 없음 - 업그레이드 페이지로
    const upgrade = new URL("/dashboard", req.url);
    upgrade.searchParams.set("notice", "membership_required");
    upgrade.searchParams.set("target", plan);
    return NextResponse.redirect(upgrade);
  }

  // 3. 플랜 레벨 체크
  const userPlan = membership.plan_id as PlanId;
  if (!hasAccessOrHigher(userPlan, plan)) {
    // 권한 부족 - 업그레이드 필요
    const upgrade = new URL("/dashboard", req.url);
    upgrade.searchParams.set("notice", "upgrade_required");
    upgrade.searchParams.set("target", plan);
    return NextResponse.redirect(upgrade);
  }

  // 4. 모든 체크 통과 - Framer 페이지로 리디렉션
  // 임시 토큰 생성 (선택사항 - 더 강력한 보안)
  const token = Buffer.from(JSON.stringify({
    uid,
    plan: userPlan,
    timestamp: Date.now(),
    expires: Date.now() + 60000 // 1분 유효
  })).toString('base64');

  // Framer 페이지로 토큰과 함께 리디렉션
  const framerUrl = new URL(targetUrl);
  framerUrl.searchParams.set("token", token);
  
  return NextResponse.redirect(framerUrl);
}