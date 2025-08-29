// app/api/checkout/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPayment } from "@/lib/portone";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const OK_STATUSES = ["paid", "success", "completed", "captured"]; // 안전하게 여러 케이스 허용
const FINAL_BAD = ["failed", "cancelled", "canceled"];             // 명확 실패

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { paymentId, merchantUid } = await req.json();
    if (!paymentId) {
      return NextResponse.json({ ok: false, error: "missing paymentId" }, { status: 400 });
    }

    // 빠르게 호출되면 아직 확정 전일 수 있으므로 짧게 폴링
    let last: any = null;
    for (let i = 0; i < 6; i++) { // 최대 ~3초 대기
      last = await getPayment(paymentId);
      const status = String(last?.status || "").toLowerCase();

      if (OK_STATUSES.includes(status)) {
        // (옵션) DB 업데이트 — 실패하더라도 결론에는 영향 X
        try {
          await supabaseAdmin
            .from("payments")
            .update({
              status: "paid",
              amount: last?.amount?.total ?? null,
              currency: last?.currency ?? "KRW",
            })
            .eq("merchant_uid", merchantUid || paymentId);
        } catch {}
        return NextResponse.json({
          ok: true,
          status: last?.status,
          amount: last?.amount?.total ?? null,
          currency: last?.currency ?? "KRW",
        });
      }
      if (FINAL_BAD.includes(status)) {
        return NextResponse.json({
          ok: false,
          error: "payment_failed",
          status: last?.status,
          failure: last?.failure || null,
        }, { status: 400 });
      }

      // 상태 미결정(READY 등) → 잠깐 대기 후 재시도
      await new Promise(r => setTimeout(r, 500));
    }

    // 최종판단 못함
    return NextResponse.json({
      ok: false,
      error: "pending_or_unknown_status",
      status: last?.status ?? null,
      failure: last?.failure ?? null,
    }, { status: 202 });

  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "verify_failed" },
      { status: 500 }
    );
  }
}
