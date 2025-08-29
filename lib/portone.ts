// lib/portone.ts
export type PortonePayment = {
  id: string;
  status: string;   // "PAID" 등
  amount: number;
  currency: string; // "KRW"
  orderName?: string;
};

export async function getPayment(paymentId: string, opts?: { storeId?: string }): Promise<PortonePayment> {
  const apiSecret = process.env.PORTONE_API_SECRET;
  if (!apiSecret) throw new Error("Missing PORTONE_API_SECRET");

  // SDK와 같은 환경으로 맞추기 (NEXT_PUBLIC_PORTONE_ENV 기준)
  const env = ((process.env.NEXT_PUBLIC_PORTONE_ENV || process.env.PORTONE_ENV) === 'production'
    ? 'production'
    : 'sandbox') as 'sandbox'|'production';

  // 필요 시 PORTONE_API_BASE로 수동 override 가능
  const base = process.env.PORTONE_API_BASE
    || (env === 'sandbox' ? 'https://sandbox-api.portone.io' : 'https://api.portone.io');

  const url = new URL(`${base}/payments/${encodeURIComponent(paymentId)}`);
  if (opts?.storeId) url.searchParams.set('storeId', opts.storeId); // 스토어 스코프 지정

  const r = await fetch(url.toString(), {
    headers: { Authorization: `PortOne ${apiSecret}` }, // v2 헤더
    cache: 'no-store',
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`PortOne getPayment ${r.status}: ${text || r.statusText}`);
  }
  return JSON.parse(text) as PortonePayment;
}
