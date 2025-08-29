// app/api/webhook/portone/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 상태 매핑(여유있게 허용)
const OK = new Set(["paid", "success", "completed", "captured"]);
const BAD = new Set(["failed", "cancelled", "canceled"]);

export async function POST(req: NextRequest) {
  // 1) 원본 바디/헤더(서명 검증용) 확보
  const raw = await req.text();
  const hdrs = Object.fromEntries(req.headers.entries());

  // TODO: 포트원 문서의 웹훅 서명 헤더명/검증 방식을 확인 후 아래에서 검증 추가
  // const signature = req.headers.get("x-portone-signature") ?? req.headers.get("x-webhook-signature");
  // verify(raw, signature, process.env.PORTONE_WEBHOOK_SECRET!)

  // 2) JSON 파싱
  let body: any = {};
  try { body = JSON.parse(raw || "{}"); } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // 3) 포트원 페이로드에서 공통 필드 최대한 안전하게 추출
  const p =
    body?.payment ??
    body?.data?.payment ??
    body; // 다양한 포맷 대비

  const pick = (...keys: string[]) => keys.find(k => p?.[k] != null) ? p[keys.find(k => p?.[k] != null)!] : undefined;

  const merchantUid =
    pick("merchantUid", "merchant_uid", "id", "paymentId") || body?.merchantUid || body?.paymentId;

  const transactionId =
    pick("transactionId", "txId", "txid") || body?.transactionId;

  const status = String(
    pick("status", "paymentStatus") || body?.status || ""
  ).toLowerCase();

  const amountTotal =
    p?.amount?.total ?? p?.amount ?? body?.amount?.total ?? null;

  const currency =
    p?.currency ?? body?.currency ?? "KRW";

  // 4) 필수: merchantUid가 없으면 매칭 불가
  if (!merchantUid) {
    console.warn("[portone webhook] missing merchantUid", { hdrs, body });
    return NextResponse.json({ ok: false, error: "missing_merchant_uid" }, { status: 400 });
  }

  // 5) 먼저 payments 테이블 갱신(멱등: merchant_uid UNIQUE 가정)
  const upd = {
    status: OK.has(status) ? "paid" : BAD.has(status) ? "failed" : status || "unknown",
    portone_payment_id: merchantUid, // v2에선 id==merchantUid로 쓰는 경우가 많음(우리 생성값)
    portone_transaction_id: transactionId ?? null,
    amount_total: amountTotal ?? null,
    currency,
    failure: BAD.has(status) ? (p?.failure ?? body?.failure ?? null) : null,
    updated_at: new Date().toISOString(),
  };

  // 대상 payment 찾기(주문 생성 시 저장한 merchant_uid와 매칭)
  const { data: payRow, error: selErr } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("merchant_uid", merchantUid)
    .maybeSingle();

  if (selErr) {
    console.error("[payments.select]", selErr);
  }

  if (!payRow) {
    // 주문 레코드가 없다면(예외), 최소한 로그만 남기고 200으로 응답
    console.warn("[payments.select] not found by merchant_uid", merchantUid, { body });
  } else {
    const { error: upErr } = await supabaseAdmin
      .from("payments")
      .update(upd)
      .eq("merchant_uid", merchantUid);

    if (upErr) console.error("[payments.update]", upErr);

    // 6) 결제 성공이면 memberships 활성화(멱등 upsert)
    if (OK.has(status)) {
      const { user_id, plan_id } = payRow;
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
  }

  // 7) 최종 응답
  return NextResponse.json({ ok: true });
}
