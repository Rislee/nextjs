// lib/portone.ts
export type PortonePayment = {
  id: string;                 // 포트원 결제 ID (imp_uid 유사)
  status: 'PAID' | 'FAILED' | 'CANCELED' | string;
  currency?: string;
  orderName?: string;
  amount?: { total?: number } | null;
  merchantId?: string | null;
  storeId?: string | null;
  channel?: { key?: string | null } | null;
  customer?: { id?: string | null } | null;
  // v1 응답 차이를 흡수하기 위해 느슨하게 둠
};

export async function getPaymentById(paymentId: string): Promise<PortonePayment> {
  const secret = process.env.PORTONE_V1_API_SECRET!;
  const r = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `PortOne ${secret}` },
    // 웹훅/검증은 항상 최신값 필요
    cache: 'no-store',
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`PortOne getPayment ${r.status}${text ? `: ${text}` : ''}`);
  }
  return r.json();
}
