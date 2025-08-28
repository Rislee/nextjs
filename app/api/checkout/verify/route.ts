import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPayment } from "@/lib/portone";

type PlanId = "START_OS" | "SIGNATURE_OS" | "MASTER_OS";

const PRICE: Record<PlanId, number> = {
  START_OS: 5_500_000,
  SIGNATURE_OS: 9_900_000,
  MASTER_OS: 19_900_000,
};

function parsePlan(paymentId: string): PlanId | null {
  const m = paymentId.match(/inneros_(START_OS|SIGNATURE_OS|MASTER_OS)_/);
  return (m?.[1] as PlanId) || null;
}

export async function POST(req: NextRequest) {
  try {
    const { paymentId } = (await req.json()) as { paymentId?: string };
    if (!paymentId) {
      return NextResponse.json({ ok: false, error: "missing paymentId" }, { status: 400 });
    }

    const plan = parsePlan(paymentId);
    if (!plan) {
      return NextResponse.json({ ok: false, error: "invalid paymentId format" }, { status: 400 });
    }

    const jar: any = (cookies as any)();
    const uid = jar?.get?.("uid")?.value;
    if (!uid) {
      return NextResponse.json({ ok: false, error: "no uid cookie" }, { status: 401 });
    }

    // PortOne 단건 조회
    const pay = await getPayment(paymentId);

    const isPaid = (pay.status || "").toUpperCase() === "PAID";
    const amountOK = Number(pay.amount) === PRICE[plan];

    if (!isPaid || !amountOK) {
      return NextResponse.json({ ok: false, error: `not paid or amount mismatch` }, { status: 400 });
    }

    // 멤버십 활성화 (존재한다고 했던 memberships 테이블)
    const next = new Date();
    next.setMonth(next.getMonth() + 1);

    await supabaseAdmin.from("memberships").upsert({
      user_id: uid,
      plan_id: plan,
      status: "active",
      current_period_end: next.toISOString(),
    }, { onConflict: "user_id" } as any);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "verify failed" }, { status: 500 });
  }
}
