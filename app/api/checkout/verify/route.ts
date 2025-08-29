// app/api/checkout/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPayment } from "@/lib/portone";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { paymentId, merchantUid } = await req.json();
    if (!paymentId) {
      return NextResponse.json({ ok: false, error: "missing paymentId" }, { status: 400 });
    }

    // PortOne 서버-서버 조회
    const p = await getPayment(paymentId);
    const status = String(p.status || "").toLowerCase();
    const ok = ["paid", "success", "completed"].includes(status);

    // payments 테이블이 있다면 상태/금액 업데이트 (없어도 전체 플로우엔 지장 없음)
    try {
      await supabaseAdmin
        .from("payments")
        .update({
          status: ok ? "paid" : status,
          amount: p.amount?.total ?? null,
          currency: p.currency ?? "KRW",
        })
        .eq("merchant_uid", merchantUid || paymentId);
    } catch (_) {}

    // 성공 시 멤버십 활성화 (payments에 user_id/plan_id가 기록되어 있다는 가정)
    if (ok) {
      try {
        const { data } = await supabaseAdmin
          .from("payments")
          .select("user_id, plan_id")
          .eq("merchant_uid", merchantUid || paymentId)
          .maybeSingle();

        if (data?.user_id && data?.plan_id) {
          await supabaseAdmin.from("memberships").upsert({
            user_id: data.user_id,
            plan_id: data.plan_id,
            status: "active",
            current_period_end: addMonth(new Date()),
          });
        }
      } catch (_) {}
    }

    return NextResponse.json({ ok, payment: p });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "verify failed" }, { status: 500 });
  }
}

function addMonth(d: Date) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1);
  return x;
}
