import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { userId, planId } = await req.json();

    if (!userId || !planId) {
      return NextResponse.json(
        { ok: false, error: "missing params" },
        { status: 400 }
      );
    }

    // 1) 플랜 조회
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("plans")
      .select("id,name,price,currency")
      .eq("id", planId)
      .maybeSingle();

    if (planErr) {
      return NextResponse.json({ ok: false, error: planErr.message }, { status: 500 });
    }
    if (!plan) {
      return NextResponse.json({ ok: false, error: "invalid plan" }, { status: 400 });
    }

    // 2) 주문번호 생성
    const merchant_uid = `${userId}-${Date.now()}`;

    // 3) 결제 전 기록 (pending)
    const { error: payErr } = await supabaseAdmin.from("payments").upsert({
      user_id: userId,
      plan_id: plan.id,
      merchant_uid,
      amount: plan.price,
      currency: plan.currency ?? "KRW",
      status: "pending",
      raw: null,
    });

    if (payErr) {
      return NextResponse.json({ ok: false, error: payErr.message }, { status: 500 });
    }

    // 4) 결제 시작 정보 응답
    return NextResponse.json({
      ok: true,
      merchant_uid,
      plan: { id: plan.id, name: plan.name },
      amount: plan.price,
      currency: plan.currency ?? "KRW",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
