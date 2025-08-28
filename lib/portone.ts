// lib/portone.ts (server-only)
export type PortonePayment = {
  id: string;
  status: string;   // "PAID" 등
  amount: number;
  currency: string; // "KRW"
  orderName?: string;
};

export async function getPayment(paymentId: string, opts?: { storeId?: string }) {
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) throw new Error("Missing PORTONE_API_SECRET");

  const base = process.env.PORTONE_API_BASE || "https://api.portone.io";
  const url = new URL(`${base}/payments/${encodeURIComponent(paymentId)}`);
  if (opts?.storeId) url.searchParams.set("storeId", opts.storeId);

  const r = await fetch(url.toString(), {
    headers: { Authorization: `PortOne ${apiSecret}` },
    cache: "no-store",
  });

  const text = await r.text();
  if (!r.ok) {
    // 401이면 보통 시크릿이 잘못됐거나 권한 문제
    throw new Error(`PortOne getPayment ${r.status}: ${text || r.statusText}`);
  }
  return JSON.parse(text) as PortonePayment;
}
