// lib/portone.ts
export type PortonePayment = {
  id: string;
  status: string; // "PAID" | "SUCCESS" 등
  amount?: { total?: number };
  currency?: string; // "KRW"
  orderName?: string;
};

export async function getPayment(paymentId: string): Promise<PortonePayment> {
  const secret = (process.env.PORTONE_API_SECRET ?? "").trim();
  if (!secret) throw new Error("missing PORTONE_API_SECRET");

  const url = `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `PortOne ${secret}` },
    cache: "no-store",
  });

  const text = await res.text(); // 에러 메시지 보존
  if (!res.ok) {
    throw new Error(`PortOne getPayment ${res.status}: ${text || ""}`.trim());
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("PortOne getPayment: bad JSON");
  }
}
