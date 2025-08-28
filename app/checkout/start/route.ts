// app/api/checkout/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { userId, planId } = await req.json();
    if (!userId || !planId) {
      return NextResponse.json({ ok: false, error: "missing params" }, { status: 400 });
    }

    // 1) 플랜 조회 (plans: id,name,price,currency)
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("plans")
      .select("id,name,price,currency")
      .eq("id", planId)
      .maybeSingle();

    if (planErr) return NextResponse.json({ ok: false, error: planErr.message }, { status: 500 });
    if (!plan) return NextResponse.json({ ok: false, error: "invalid plan" }, { status: 400 });

    // 2) 주문번호 생성
    const merchantUid = `inneros_${planId}_${Date.now()}`;

    // 3) orders 테이블에 pending 기록
    const { error: insErr } = await supabaseAdmin.from("orders").insert({
      user_id: userId,
      plan_id: plan.id,
      merchant_uid: merchantUid,
      amount: plan.price,
      currency: plan.currency,
      status: "pending",
    });
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      merchantUid,
      amount: plan.price,
      currency: plan.currency,
      orderName: `InnerOS ${plan.name}`,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
