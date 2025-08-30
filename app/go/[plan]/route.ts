// app/go/[plan]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PLAN_TO_FRAMER_URL, type PlanId } from "@/lib/plan";

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

  // 2. 사용자의 활성 플랜들 조회 (다중 플랜 지원)
  const { data: userPlans } = await supabaseAdmin
    .from("user_plans")
    .select("plan_id, status")
    .eq("user_id", uid)
    .eq("status", "active");

  console.log(`[/go/${plan}] User ${uid} has plans:`, userPlans);

  if (!userPlans || userPlans.length === 0) {
    console.log(`[/go/${plan}] No active plans found, redirecting to checkout`);
    // 활성 플랜 없음 - 결제 페이지로
    const checkout = new URL(`/checkout/${plan}`, req.url);
    return NextResponse.redirect(checkout);
  }

  // 3. 해당 플랜 권한 확인
  const hasTargetPlan = userPlans.some(p => p.plan_id === plan);
  
  if (!hasTargetPlan) {
    console.log(`[/go/${plan}] User doesn't have ${plan}, has:`, userPlans.map(p => p.plan_id));
    // 해당 플랜 권한 없음 - 결제 페이지로
    const checkout = new URL(`/checkout/${plan}`, req.url);
    return NextResponse.redirect(checkout);
  }

  console.log(`[/go/${plan}] Access granted, redirecting to Framer`);

  // 4. 챗봇용 토큰 생성 (더 긴 유효시간)
  const token = Buffer.from(JSON.stringify({
    uid,
    targetPlan: plan,
    userPlans: userPlans.map(p => p.plan_id),
    timestamp: Date.now(),
    expires: Date.now() + (2 * 60 * 60 * 1000) // 2시간 유효
  })).toString('base64');

  // 5. Framer 페이지로 토큰과 함께 리디렉션
  const framerUrl = new URL(targetUrl);
  framerUrl.searchParams.set("token", token);
  
  return NextResponse.redirect(framerUrl);
}