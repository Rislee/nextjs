// app/api/checkout/start/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PlanId = "START_OS" | "SIGNATURE_OS" | "MASTER_OS";

const PRICE: Record<PlanId, number> = {
  START_OS: 5_500_000,
  SIGNATURE_OS: 9_900_000,
  MASTER_OS: 19_900_000,
};

const LABEL: Record<PlanId, string> = {
  START_OS: "Start OS",
  SIGNATURE_OS: "Signature OS",
  MASTER_OS: "Master OS",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  // 1) 입력
  let body: any = {};
  try { body = await req.json(); } catch {}
  const planId = body?.planId as PlanId | undefined;
  if (!planId || !(planId in PRICE)) {
    return NextResponse.json({ ok: false, error: "invalid planId" }, { status: 400 });
  }

  // 2) uid 쿠키
  const jar = await cookies();
  const uid = jar.get("uid")?.value;
  if (!uid) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 3) 주문 생성
  const merchantUid = `inneros_${planId}_${Date.now()}`;
  const amount = PRICE[planId];
  const currency = "KRW";
  const orderName = `InnerOS ${LABEL[planId]}`;

  // (선택) DB에 기록 — 에러는 무시하고 계속 진행
  const { error: insertErr } = await supabaseAdmin
    .from("payments")
    .insert({
      merchant_uid: merchantUid,
      user_id: uid,
      plan_id: planId,
      amount_total: amount,
      currency,
      status: "pending",
    });

  if (insertErr) {
    // 서버 로그만 남기고 흐름 계속
    console.warn("[payments.insert] failed:", insertErr.message);
  }

  // 4) 클라로 반환
  return NextResponse.json({
    ok: true,
    merchantUid,
    amount,
    currency,
    orderName,
  });
}

// 디버깅용: GET으로 접근하면 405 안내
export async function GET() {
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}
