import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPayment } from "@/lib/portone";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

    const jar = await cookies();
    const uid = jar.get("uid")?.value;
    if (!uid) {
      return NextResponse.json({ ok: false, error: "no uid cookie" }, { status: 401 });
    }

    // v2 단건조회
    const pay: any = await getPayment(paymentId);

    // v2 스키마 대응: amount.total 사용 (구버전/타입 혼재 대비 fallback 포함)
    const status = String(pay.status || "").toUpperCase();
    const paidAmount =
      typeof pay.amount === "number"
        ? Number(pay.amount)
        : Number(pay.amount?.total);

    const isPaid = status === "PAID";
    const amountOK = paidAmount === PRICE[plan];

    if (!isPaid) {
      // 실패/중단 원인을 그대로 반환해 디버깅 가능하게
      return NextResponse.json(
        {
          ok: false,
          status,
          reason: pay.failure?.reason || null,
          pgCode: pay.failure?.pgCode || null,
          pgMessage: pay.failure?.pgMessage || null,
        },
        { status: 400 }
      );
    }

    if (!amountOK) {
      return NextResponse.json(
        {
          ok: false,
          status,
          error: `amount mismatch: expected ${PRICE[plan]}, got ${paidAmount}`,
        },
        { status: 400 }
      );
    }

    // 여기까지 왔으면 정상 결제 → 멤버십 활성화
    const next = new Date();
    next.setMonth(next.getMonth() + 1);

    const { error } = await supabaseAdmin.from("memberships").upsert(
      {
        user_id: uid,
        plan_id: plan,
        status: "active",
        current_period_end: next.toISOString(),
      },
      { onConflict: "user_id" } as any
    );

    if (error) {
      // 결제는 정상이므로 200 + 경고 반환
      return NextResponse.json({
        ok: true,
        warning: `membership upsert failed: ${error.message}`,
      });
    }

    return NextResponse.json({ ok: true, status, amount: paidAmount });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 502 }
    );
  }
}
