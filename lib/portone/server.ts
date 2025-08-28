// lib/portone/server.ts
// (서버에서만 import! api routes, server actions 등)

export type PortonePayment = {
  id: string;
  status: string;   // e.g. "PAID"
  amount: number;
  currency: string; // e.g. "KRW"
  merchant: { id?: string };
  orderName?: string;
};

export async function getPayment(paymentId: string): Promise<PortonePayment> {
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) throw new Error("Missing PORTONE_API_SECRET");

  const r = await fetch(`https://api.portone.io/payments/${paymentId}`, {
    headers: {
      // PortOne v2 REST: 서버 비밀키로 인증
      Authorization: `PortOne ${apiSecret}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await r.text();
  if (!r.ok) {
    throw new Error(`PortOne getPayment ${r.status}: ${text || "no body"}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("PortOne getPayment: invalid JSON");
  }
}
