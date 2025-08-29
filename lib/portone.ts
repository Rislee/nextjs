// lib/portone.ts  — v2 전용 (호스트 고정: https://api.portone.io)
export type PortonePayment = {
  id: string;
  status: string;   // "PAID" 등
  amount: number;
  currency: string; // "KRW"
  orderName?: string;
};

export async function getPayment(
  paymentId: string,
  opts?: { storeId?: string }
): Promise<PortonePayment> {
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) throw new Error("Missing PORTONE_API_SECRET");

  // ✅ v2는 항상 이 호스트. 필요하면 PORTONE_API_BASE로만 오버라이드
  const base = process.env.PORTONE_API_BASE || "https://api.portone.io";

  const url = new URL(`${base}/payments/${encodeURIComponent(paymentId)}`);
  if (opts?.storeId) url.searchParams.set("storeId", opts.storeId);

  const r = await fetch(url.toString(), {
    headers: { Authorization: `PortOne ${apiSecret}` }, // ✅ 접두사 포함
    cache: "no-store",
  });

  const text = await r.text();
  if (!r.ok) {
    throw new Error(`PortOne getPayment ${r.status}: ${text || r.statusText}`);
  }
  return JSON.parse(text) as PortonePayment;
}
