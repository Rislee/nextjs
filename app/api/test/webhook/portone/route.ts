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
function hasCol(row: Record<string, any>, col: string) {
  return Object.prototype.hasOwnProperty.call(row, col);
}
function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET() {
  return json({ ok: true, method: "GET" });
}

export async function POST(req: Request) {
  // 내부 보호키 검사
  const key = req.headers.get("x-internal-key") || "";
  if (key !== (process.env.INTERNAL_API_KEY ?? "")) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  // 바디 파싱
  let body: any = {};
  try { body = await req.json(); } catch {}
  const d: any = body?.data ?? body ?? {};

  // merchantUid (= payments.merchant_uid) 필수
  const merchantUid: string | undefined =
    pick(d, "paymentId", "id", "merchantUid", "merchant_uid");
  if (!merchantUid) return json({ ok: false, error: "missing_paymentId" }, 400);

  // 상태/금액 등 추출
  const statusRaw = String(pick(d, "status", "paymentStatus") ?? "").toLowerCase();
  const amountObj = pick(d, "amount");
  const amountRaw: any = amountObj?.total ?? amountObj ?? null;
  const amount =
    typeof amountRaw === "number" ? amountRaw :
    typeof amountRaw === "string" ? Number(amountRaw) : null;
  const currency: string = String(pick(d, "currency") ?? "KRW");
  const mappedStatus =
    OK.has(statusRaw) ? "paid" : BAD.has(statusRaw) ? "failed" : (statusRaw || "unknown");

  // 주문 조회 (현재 스키마 파악 용도로도 사용)
  const sel = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("merchant_uid", merchantUid)
    .maybeSingle();

  if (sel.error) return json({ ok: false, step: "select", error: "select_failed", detail: sel.error }, 500);
  if (!sel.data) return json({ ok: false, error: "payment_not_found", merchantUid }, 404);

  const payRow = sel.data as Record<string, any>;

  // 존재하는 컬럼만 조건부 업데이트
  const upd: Record<string, any> = {};

  // status 컬럼이 있으면 업데이트
  if (hasCol(payRow, "status")) upd.status = mappedStatus;

  // 금액 컬럼명 불일치 방지: amount / amount_total 등 케이스별로
  if (typeof amount === "number") {
    if (hasCol(payRow, "amount")) upd.amount = amount;
    else if (hasCol(payRow, "amount_total")) upd.amount_total = amount;
  }

  // currency 컬럼이 존재할 때만
  if (hasCol(payRow, "currency")) upd.currency = currency;

  // 타임스탬프 컬럼 존재할 때만
  const nowIso = new Date().toISOString();
  if (hasCol(payRow, "updated_at")) upd.updated_at = nowIso;
  else if (hasCol(payRow, "updatedAt")) upd.updatedAt = nowIso;

  // 문제: upd가 비면 update 호출 시 의미가 없음 → 최소 status라도 없으면 스킵
  if (Object.keys(upd).length > 0) {
    const up = await supabaseAdmin
      .from("payments")
      .update(upd)
      .eq("merchant_uid", merchantUid);
    if (up.error) {
      return json({ ok: false, step: "payments.update", error: "update_failed", detail: up.error }, 500);
    }
  }

  // OK 상태면 memberships 갱신 (존재 컬럼만)
  let membershipUpserted = false;
  if (OK.has(statusRaw)) {
    const user_id = payRow["user_id"];
    const plan_id = payRow["plan_id"];
    if (user_id && plan_id) {
      // 먼저 update 시도 (존재 컬럼만)
      const memUpd: Record<string, any> = {};
      // status/plan_id 컬럼 유무 확인
      // memberships 테이블의 기존 한 줄을 조회해서 스키마 파악
      const memSel = await supabaseAdmin
        .from("memberships")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle();

      const memRow = memSel.data as Record<string, any> | null;

      // 존재 컬럼 판단은 memRow가 있으면 memRow로, 없으면 payments와 동일 가정 불가 → 보수적으로 흔한 컬럼만 시도
      const memCols = new Set<string>(memRow ? Object.keys(memRow) : []);

      if (memRow) {
        if (memCols.has("status")) memUpd.status = "active";
        if (memCols.has("plan_id")) memUpd.plan_id = plan_id;
        if (memCols.has("updated_at")) memUpd.updated_at = nowIso;
        if (memCols.has("updatedAt")) memUpd.updatedAt = nowIso;

        if (Object.keys(memUpd).length > 0) {
          const up1 = await supabaseAdmin
            .from("memberships")
            .update(memUpd)
            .eq("user_id", user_id);
          if (up1.error) {
            return json({ ok: false, step: "memberships.update", error: "update_failed", detail: up1.error }, 500);
          }
          membershipUpserted = true;
        } else {
          // 업데이트할 컬럼이 하나도 없으면 패스
          membershipUpserted = true; // 최소한 로직은 통과
        }
      } else {
        // 없으면 insert — 존재 가능성이 높은 컬럼만 조합
        const memIns: Record<string, any> = { user_id };
        // plan_id/status 컬럼 존재 여부를 모를 때는 insert 실패 가능성 있지만, 에러를 그대로 반환해 스키마 보정에 쓰자
        memIns.plan_id = plan_id;
        memIns.status = "active";
        memIns.updated_at = nowIso; // 없어도 무해 (없으면 에러 → 메시지로 확인 가능)
        const ins = await supabaseAdmin.from("memberships").insert(memIns);
        if (ins.error) {
          return json({ ok: false, step: "memberships.insert", error: "insert_failed", detail: ins.error }, 500);
        }
        membershipUpserted = true;
      }
    }
  }

  return json({ ok: true, merchantUid, mappedStatus, membershipUpserted }, 200);
}
