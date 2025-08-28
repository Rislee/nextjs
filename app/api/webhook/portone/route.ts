import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Webhook } from "@portone/server-sdk";
import { getPayment } from "@/lib/portone";

export const runtime = "nodejs";

// ✅ 타입 워크어라운드(전역 재사용)
const Verified = Webhook as unknown as {
  verify: (
    secret: string,
    payload: string,
    headers: Record<string, string | string[] | undefined>
  ) => Promise<any>;
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const headersObj = Object.fromEntries(req.headers.entries());
  const secret = process.env.PORTONE_WEBHOOK_SECRET!;
  if (!secret) return NextResponse.json({ ok: false, error: "missing PORTONE_WEBHOOK_SECRET" }, { status: 500 });

  try {
    const payload: any = await Verified.verify(secret, rawBody, headersObj);

    const paymentId: string | undefined = payload?.paymentId ?? payload?.id;
    const merchantUid: string | undefined =
      payload?.merchantOrderId ?? payload?.merchant_order_id ?? payload?.merchant_uid;
    if (!paymentId || !merchantUid) {
      return NextResponse.json({ ok: false, error: "bad payload: missing ids" }, { status: 400 });
    }

    const { data: pay, error: findErr } = await supabaseAdmin
      .from("payments")
      .select("id,user_id,plan_id,amount,currency,status")
      .eq("merchant_uid", merchantUid)
      .maybeSingle();
    if (findErr) return NextResponse.json({ ok: false, error: findErr.message }, { status: 500 });

    // ✅ 이미 처리된 건이면 조용히 OK (멱등)
    if (pay?.status === "paid") {
      return NextResponse.json({ ok: true, note: "already paid" });
    }

    // 서버-서버 검증
    const remote = await getPayment(paymentId);
    const statusStr = String(remote.status ?? "").toLowerCase();
    const okStatus = ["paid", "success", "completed"].includes(statusStr);

    // ✅ 기대 금액 확정(없으면 plans에서 보강)
    let expected = pay?.amount as number | null | undefined;
    if ((expected == null) && pay?.plan_id) {
      const { data: planRow } = await supabaseAdmin
        .from("plans").select("price").eq("id", pay.plan_id).maybeSingle();
      expected = planRow?.price ?? expected;
    }
    const okAmount = expected != null && Number(expected) === Number(remote.amount);

    await supabaseAdmin.from("payments").upsert(
      {
        user_id: pay?.user_id ?? null,
        plan_id: pay?.plan_id ?? null,
        merchant_uid: merchantUid,
        imp_uid: paymentId,
        amount: Number(remote.amount ?? payload?.amount ?? 0),
        currency: String(remote.currency ?? payload?.currency ?? "KRW"),
        status: okStatus ? "paid" : statusStr || "failed",
        raw: payload,
      },
      { onConflict: "merchant_uid" }
    );

    if (okStatus && okAmount && pay?.user_id && pay?.plan_id) {
      const next = addMonth(new Date());
      await supabaseAdmin.from("memberships").upsert({
        user_id: pay.user_id,
        plan_id: pay.plan_id,
        status: "active",
        current_period_end: next,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "verify failed" }, { status: 400 });
  }
}

function addMonth(d: Date) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + 1);
  return x;
}
