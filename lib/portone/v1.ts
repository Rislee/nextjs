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
    throw new Error('Missing PortOne v1 API key/secret (PORTONE_V1_API_KEY / PORTONE_V1_API_SECRET)');
  }
  const r = await fetch(`${BASE}/users/getToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imp_key: apiKey, imp_secret: apiSecret }),
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  const token = j?.response?.access_token as string | undefined;
  if (!r.ok || !token) {
    const msg = (j && (j.message || j.msg)) || r.statusText || 'unknown error';
    throw new Error(`getV1AccessToken failed: ${msg}`);
  }
  return token;
}

export async function getV1Payment(impUid: string, accessToken: string): Promise<PaymentV1> {
  const r = await fetch(`${BASE}/payments/${encodeURIComponent(impUid)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  const p = j?.response;
  if (!r.ok || !p) {
    const msg = (j && (j.message || j.msg)) || r.statusText || 'unknown error';
    throw new Error(`getV1Payment failed: ${msg}`);
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
