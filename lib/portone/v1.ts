// lib/portone/v1.ts
export type PaymentV1 = {
  imp_uid: string;
  merchant_uid: string;
  status: 'ready' | 'paid' | 'failed' | 'cancelled' | string;
  amount: number;
  currency?: string;
  fail_reason?: string | null;
};

const BASE = 'https://api.iamport.kr';

export async function getV1AccessToken(): Promise<string> {
  const apiKey = process.env.PORTONE_V1_API_KEY!;
  const apiSecret = process.env.PORTONE_V1_API_SECRET!;
  if (!apiKey || !apiSecret) {
    throw new Error('Missing PORTONE_V1_API_KEY/PORTONE_V1_API_SECRET');
  }

  const r = await fetch(`${BASE}/users/getToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ imp_key: apiKey, imp_secret: apiSecret }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`getToken ${r.status}${t ? `: ${t}` : ''}`);
  }

  const j = await r.json().catch(() => ({}));
  const token: string | undefined = j?.response?.access_token;
  if (!token) throw new Error('No access_token in response');
  return token;
}

export async function getV1Payment(impUid: string, accessToken: string): Promise<PaymentV1> {
  if (!impUid) throw new Error('impUid required');
  if (!accessToken) throw new Error('accessToken required');

  const r = await fetch(`${BASE}/payments/${encodeURIComponent(impUid)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`getPayment ${r.status}${t ? `: ${t}` : ''}`);
  }

  const j = await r.json().catch(() => ({}));
  const p = j?.response;

  if (!p?.imp_uid) {
    throw new Error('Invalid payment response');
  }

  return {
    imp_uid: p.imp_uid,
    merchant_uid: p.merchant_uid,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    fail_reason: p.fail_reason ?? null,
  };
}
