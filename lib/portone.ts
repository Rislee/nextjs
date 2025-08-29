// lib/portone.ts (server-only)
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

  // ✅ 결제 SDK env에 맞춰 API base 자동 선택
  const env =
    (process.env.NEXT_PUBLIC_PORTONE_ENV ||
      process.env.PORTONE_ENV ||
      "sandbox") as "sandbox" | "production";

  // 필요하면 PORTONE_API_BASE로 강제 오버라이드 가능
  const base =
    process.env.PORTONE_API_BASE ||
    (env === "sandbox"
      ? "https://sandbox-api.portone.io"
      : "https://api.portone.io");

  const url = new URL(`${base}/payments/${encodeURIComponent(paymentId)}`);
  if (opts?.storeId) url.searchParams.set("storeId", opts.storeId); // ✅ 스토어 스코프 지정

  const r = await fetch(url.toString(), {
    headers: { Authorization: `PortOne ${apiSecret}` }, // ✅ v2 형식
    cache: "no-store",
  });

  const text = await r.text();
  if (!r.ok) {
    // 에러 본문 포함해주면 디버깅 쉬움
    throw new Error(`PortOne getPayment ${r.status}: ${text || r.statusText}`);
  }
  return JSON.parse(text) as PortonePayment;
}
