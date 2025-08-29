// app/api/webhook/portone/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "@portone/server-sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// 결제 상태 매핑(여유 있게 커버)
const OK = new Set(["paid", "success", "completed", "captured", "succeeded", "approved"]);
const BAD = new Set(["failed", "cancelled", "canceled", "refused", "declined"]);

function pick(obj: any, ...keys: string[]) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const secret = (process.env.PORTONE_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    console.error("[portone:webhook] missing PORTONE_WEBHOOK_SECRET");
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }

  // ✅ 반드시 raw body로 검증
  const raw = await req.text();
  const headers = Object.fromEntries(req.headers);

  let parsed: any;
  try {
    // SDK 타입 이슈 회피: as any로 verify 호출
    parsed = await (Webhook as any).verify(secret, raw, headers);
  } catch (e: any) {
    console.error("[portone:webhook] verify failed:", e?.message || e);
    // 서명 불일치/검증 실패 → 401 (포트원이 재시도 가능)
    return NextResponse.json({ ok: false, error: "signature_invalid" }, { status: 401 });
  }

  // parsed.type ("Transaction.Paid" 등), parsed.data 내부에 주요 필드가 들어옴
  const d: any = parsed?.data ?? {};

  const merchantUid: string | undefined =
    pick(d, "paymentId", "id", "merchantUid", "merchant_uid");

  const statusRaw = String(pick(d, "status", "paymentStatus") ?? "").toLowerCase();
  const amountObj = pick(d, "amount");
  const amountTotal: number | null = amountObj?.total ?? amountObj ?? null;
  const currency: string = pick(d, "currency") ?? "KRW";
  const transactionId: string | undefined =
    pick(d, "transactionId", "txId", "txid");
  const failure = BAD.has(statusRaw) ? (pick(d, "failure") ?? null) : null;

  if (!merchantUid) {
    console.warn("[portone:webhook] missing merchantUid", { parsed });
    // 연결은 성공 처리(중복 재시도 방지), 내부 경고만
    return NextResponse.json({ ok: true, warn: "missing_merchant_uid" });
  }

  // payments에서 주문 찾기 (merchant_uid UNIQUE 가정)
  const { data: payRow, error: selErr } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("merchant_uid", merchantUid)
    .maybeSingle();

  if (selErr) console.error("[payments.select]", selErr);

  const mappedStatus =
    OK.has(statusRaw) ? "paid" : BAD.has(statusRaw) ? "failed" : statusRaw || "unknown";

  const upd = {
    status: mappedStatus,
    portone_payment_id: merchantUid,
    portone_transaction_id: transactionId ?? null,
    amount_total: amountTotal ?? null,
    currency,
    failure,
    updated_at: new Date().toISOString(),
  };

  if (payRow) {
    const { error: upErr } = await supabaseAdmin
      .from("payments")
      .update(upd)
      .eq("merchant_uid", merchantUid);
    if (upErr) console.error("[payments.update]", upErr);

    // 성공이면 memberships 활성화(멱등 upsert)
    if (OK.has(statusRaw)) {
      const { user_id, plan_id } = payRow as any;
      if (user_id && plan_id) {
        const { error: upsertErr } = await supabaseAdmin
          .from("memberships")
          .upsert(
            {
              user_id,
              plan_id,
              status: "active",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
        if (upsertErr) console.error("[memberships.upsert]", upsertErr);
      }
    }
  } else {
    console.warn("[payments] not found by merchant_uid", merchantUid);
  }

  // 항상 2xx로 응답(포트원 재시도 방지). 내부 오류는 로그로 추적
  return NextResponse.json({ ok: true });
}

// 사전 체크용 핸들러 유지
export async function GET() {
  return NextResponse.json({ ok: true, method: "GET" }, { status: 200 });
}
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
