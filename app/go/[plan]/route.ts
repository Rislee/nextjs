// app/go/[plan]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PLAN_TO_FRAMER_URL, hasSpecificAccess, type PlanId } from "@/lib/plan";

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
    // 멤버십 없음 - 결제 페이지로
    const checkout = new URL(`/checkout/${plan}`, req.url);
    return NextResponse.redirect(checkout);
  }

  // 3. 개별 플랜 권한 체크 - 정확히 해당 플랜을 보유하고 있는지 확인
  const userPlan = membership.plan_id as PlanId;
  if (!hasSpecificAccess(userPlan, plan)) {
    // 해당 플랜 권한 없음 - 결제 페이지로
    const checkout = new URL(`/checkout/${plan}`, req.url);
    return NextResponse.redirect(checkout);
  }

  // 4. 모든 체크 통과 - Framer 페이지로 리디렉션
  // 임시 토큰 생성 (선택사항)
  const token = Buffer.from(JSON.stringify({
    uid,
    plan: userPlan,
    targetPlan: plan,
    timestamp: Date.now(),
    expires: Date.now() + 60000 // 1분 유효
  })).toString('base64');

  // Framer 페이지로 토큰과 함께 리디렉션
  const framerUrl = new URL(targetUrl);
  framerUrl.searchParams.set("token", token);
  
  return NextResponse.redirect(framerUrl);
}