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
  return json({ ok: true, method: "GET" }, 200);
}

export async function POST(req: Request) {
  const key = req.headers.get("x-internal-key") || "";
  if (key !== (process.env.INTERNAL_API_KEY ?? "")) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: any = {};
  try { body = await req.json(); } catch {}

  const d: any = body?.data ?? body ?? {};
  const merchantUid: string | undefined =
    pick(d, "paymentId", "id", "merchantUid", "merchant_uid");

  if (!merchantUid) return json({ ok: false, error: "missing_paymentId" }, 400);

  const statusRaw = String(pick(d, "status", "paymentStatus") ?? "").toLowerCase();
  const amountObj = pick(d, "amount");
  const amountRaw: any = amountObj?.total ?? amountObj ?? null;
  const amount =
    typeof amountRaw === "number" ? amountRaw :
    typeof amountRaw === "string" ? Number(amountRaw) : null;

  const currency: string = String(pick(d, "currency") ?? "KRW");
  const transactionId: string | undefined = pick(d, "transactionId", "txId", "txid");
  const failure = BAD.has(statusRaw) ? (pick(d, "failure") ?? null) : null;

  const mappedStatus =
    OK.has(statusRaw) ? "paid" : BAD.has(statusRaw) ? "failed" : (statusRaw || "unknown");

  // 1) 주문 조회
  const sel = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("merchant_uid", merchantUid)
    .maybeSingle();

  if (sel.error) return json({ ok: false, step: "select", error: "select_failed", detail: sel.error }, 500);
  if (!sel.data) return json({ ok: false, error: "payment_not_found", merchantUid }, 404);

  const payRow: any = sel.data;

  // 2) payments 업데이트 (⚠ amount_total 대신 amount 사용)
  const upd: Record<string, any> = {
    status: mappedStatus,
    portone_payment_id: merchantUid,
    portone_transaction_id: transactionId ?? null,
    currency,
    failure,
    updated_at: new Date().toISOString(),
  };
  if (typeof amount === "number") {
    upd.amount = amount;                 // ← 여기!
  } else if (payRow.amount != null) {
    upd.amount = payRow.amount;          // 기존 값 유지
  }

  const up = await supabaseAdmin
    .from("payments")
    .update(upd)
    .eq("merchant_uid", merchantUid);

  if (up.error) return json({ ok: false, step: "payments.update", error: "update_failed", detail: up.error }, 500);

  // 3) memberships 활성화 (paid일 때만) — update → 없으면 insert
  let membershipUpserted = false;
  if (OK.has(statusRaw)) {
    const { user_id, plan_id } = payRow;
    if (user_id && plan_id) {
      const up1 = await supabaseAdmin
        .from("memberships")
        .update({
          plan_id,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user_id);

      if (up1.error) return json({ ok: false, step: "memberships.update", error: "update_failed", detail: up1.error }, 500);

      // 없으면 insert
      if ((up1 as any).count === 0) {
        const chk = await supabaseAdmin
          .from("memberships")
          .select("user_id")
          .eq("user_id", user_id)
          .maybeSingle();

        if (!chk.data) {
          const ins = await supabaseAdmin
            .from("memberships")
            .insert({
              user_id,
              plan_id,
              status: "active",
              updated_at: new Date().toISOString(),
            });
          if (ins.error) return json({ ok: false, step: "memberships.insert", error: "insert_failed", detail: ins.error }, 500);
        }
      }

      membershipUpserted = true;
    }
  }

  return json({ ok: true, merchantUid, mappedStatus, membershipUpserted }, 200);
}

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}
