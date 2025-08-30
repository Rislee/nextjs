import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { PLAN_TO_TITLE, PLAN_LEVEL, type PlanId } from "@/lib/plan";

export const dynamic = "force-dynamic";

const PRICE: Record<PlanId, number> = {
  START_OS: 1000,       // 테스트 금액
  SIGNATURE_OS: 2000,
  MASTER_OS: 3000,
};

function hasAccessOrHigher(userPlan: PlanId, targetPlan: PlanId) {
  return PLAN_LEVEL[userPlan] >= PLAN_LEVEL[targetPlan];
}

export async function POST(req: NextRequest) {
  // uid 쿠키 필수
  const ck = await cookies();
  const uid = ck.get("uid")?.value;
  if (!uid) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { planId } = await req.json();
  const plan = String(planId || "") as PlanId;
  if (!["START_OS", "SIGNATURE_OS", "MASTER_OS"].includes(plan)) {
    return Response.json({ ok: false, error: "invalid_plan" }, { status: 400 });
  }

  // 멤버십 조회 (활성 + 동일/더높은 등급이면 재결제 차단)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,   // 서버 전용
    { auth: { persistSession: false } }
  );

  const { data: membership } = await admin
    .from("memberships")
    .select("plan_id,status")
    .eq("user_id", uid)
    .maybeSingle();

  if (membership?.status === "active" && membership?.plan_id) {
    const userPlan = membership.plan_id as PlanId;
    if (hasAccessOrHigher(userPlan, plan)) {
      return Response.json(
        { ok: false, error: "already_active" },
        { status: 409 } // Conflict
      );
    }
  }

  // 주문 생성
  const amount = PRICE[plan];
  const orderName = PLAN_TO_TITLE[plan] || plan;
  const merchantUid = `inneros_${plan}_${Date.now()}`;

  const { error: insertErr } = await admin.from("payments").insert({
    user_id: uid,
    plan_id: plan,
    merchant_uid: merchantUid,
    status: "pending",
    amount,
    currency: "KRW",
  });

  if (insertErr) {
    return Response.json({ ok: false, error: "insert_failed" }, { status: 500 });
  }

  return Response.json({ ok: true, merchantUid, amount, orderName });
}
