import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type PlanId = "START_OS" | "SIGNATURE_OS" | "MASTER_OS";

// 서버에서 신뢰하는 금액/이름 매핑 (원하면 Supabase 테이블로 대체)
const PLAN: Record<PlanId, { name: string; price: number }> = {
  START_OS: { name: "InnerOS Start OS",      price: 5_500_000 },
  SIGNATURE_OS: { name: "InnerOS Signature OS", price: 9_900_000 },
  MASTER_OS: { name: "InnerOS Master OS",     price: 19_900_000 },
};

export async function POST(req: NextRequest) {
  try {
    const { planId } = (await req.json()) as { planId?: PlanId };
    if (!planId || !PLAN[planId]) {
      return NextResponse.json({ ok: false, error: "invalid planId" }, { status: 400 });
    }

    // uid HttpOnly 쿠키 확인 (로그인 필요)
    const jar: any = (cookies as any)();
    const uid = jar?.get?.("uid")?.value;
    if (!uid) {
      return NextResponse.json({ ok: false, error: "no uid cookie (login required)" }, { status: 401 });
    }

    // 결제ID(merchantUid) 생성: planId를 박아두면 webhook/검증에서 파싱 가능
    const merchantUid = `inneros_${planId}_${Date.now()}`;

    const { name, price } = PLAN[planId];

    // 여기서 DB에 orders/payments를 기록하고 싶다면 추가 (테이블 없으면 생략)
    // ex) await supabaseAdmin.from("orders").insert({ user_id: uid, plan_id: planId, merchant_uid: merchantUid, amount: price })

    return NextResponse.json({
      ok: true,
      merchantUid,
      orderName: name,
      amount: price,
      currency: "KRW",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "start failed" }, { status: 500 });
  }
}
