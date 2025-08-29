// app/api/test/webhook/portone/route.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const OK = new Set(["paid", "success", "completed", "captured", "succeeded", "approved", "paid_out"]);
const BAD = new Set(["failed", "cancelled", "canceled", "refused", "declined"]);

function pick(obj: any, ...keys: string[]) {
  for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  return undefined;
}

export async function GET() {
  return new Response(JSON.stringify({ ok: true, method: "GET" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// 내부 전용 테스트 엔드포인트: x-internal-key 헤더 필요
export async function POST(req: Request) {
  const key = req.headers.get("x-internal-key") || "";
  if (key !== (process.env.INTERNAL_API_KEY ?? "")) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const d: any = body?.data ?? body ?? {};

  // merchantUid (= checkout/start에서 만든 결제ID)
  const merchantUid: string | undefined =
    pick(d, "paymentId", "id", "merchantUid", "merchant_uid");
  if (!merchantUid) {
    return new Response(JSON.stringify({ ok: false, error: "missing_paymentId" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const statusRaw = String(pick(d, "status", "paymentStatus") ?? "").toLowerCase();
  const amountObj = pick(d, "amount");
  const amountTotal: number | null = amountObj?.total ?? amountObj ?? null;
  const currency: string = pick(d, "currency") ?? "KRW";
  const transactionId: string | undefined = pick(d, "transactionId", "txId", "txid");
  const failure = BAD.has(statusRaw) ? (pick(d, "failure") ?? null) : null;

  const mappedStatus =
    OK.has(statusRaw) ? "paid" : BAD.has(statusRaw) ? "failed" : (statusRaw || "unknown");

  // 주문 찾기
  const { data: payRow, error: selErr } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("merchant_uid", merchantUid)
    .maybeSingle();

  if (selErr) {
    console.error("[test:webhook] payments.select error", selErr);
    return new Response(JSON.stringify({ ok: false, error: "select_failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  if (!payRow) {
    return new Response(JSON.stringify({ ok: false, error: "payment_not_found", merchantUid }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  // payments 갱신
  const upd = {
    status: mappedStatus,
    portone_payment_id: merchantUid,
    portone_transaction_id: transactionId ?? null,
    amount_total: amountTotal ?? payRow.amount_total ?? null,
    currency: currency ?? payRow.currency ?? "KRW",
    failure,
    updated_at: new Date().toISOString(),
  };

  const { error: upErr } = await supabaseAdmin
    .from("payments")
    .update(upd)
    .eq("merchant_uid", merchantUid);

  if (upErr) {
    console.error("[test:webhook] payments.update error", upErr);
    return new Response(JSON.stringify({ ok: false, error: "update_failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // 성공이면 memberships 활성화(멱등 upsert)
  let membershipUpserted = false;
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
      if (upsertErr) {
        console.error("[test:webhook] memberships.upsert error", upsertErr);
      } else {
        membershipUpserted = true;
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, merchantUid, mappedStatus, membershipUpserted }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
