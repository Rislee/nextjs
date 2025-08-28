export type PortonePayment = {
  id: string;
  status: string;             // "PAID" 등 문서 기준
  amount: number;
  currency: string;           // "KRW"
  merchant: { id?: string };
  orderName?: string;
  // 필요하면 필드 추가
};

export async function getPayment(paymentId: string): Promise<PortonePayment> {
  const apiSecret = process.env.PORTONE_API_SECRET!;
  const r = await fetch(`https://api.portone.io/payments/${paymentId}`, {
    headers: { Authorization: `PortOne ${apiSecret}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`PortOne getPayment ${r.status}`);
  return r.json();
}
