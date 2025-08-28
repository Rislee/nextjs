// app/api/checkout/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { userId, planId } = await req.json();

    // 플랜 정보 가져오기 (예: plans 테이블에서)
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("id,name,price,currency")
      .eq("id", planId)
      .single();

    if (!plan) {
      return NextResponse.json({ ok: false, error: "plan not found" }, { status: 400 });
    }

    const merchantUid = `${userId}-${Date.now()}`;

    // payments 테이블에 임시 기록
    await supabaseAdmin.from("payments").insert({
      user_id: userId,
      plan_id: planId,
      merchant_uid: merchantUid,
      amount: plan.price,
      currency: plan.currency,
      status: "pending",
    });

    return NextResponse.json({
      ok: true,
      merchant_uid: merchantUid,
      plan,
      amount: plan.price,
      currency: plan.currency,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
