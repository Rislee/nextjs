// lib/portone/v1.ts
export type V1AccessTokenResp = {
  code: number;
  message?: string;
  response?: {
    access_token: string;
    expired_at: number;
    now: number;
  };
};

export async function getV1AccessToken(): Promise<string> {
  const key = process.env.PORTONE_V1_API_KEY!;
  const secret = process.env.PORTONE_V1_API_SECRET!;
  if (!key || !secret) throw new Error('missing_v1_keys');

  const r = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imp_key: key, imp_secret: secret }),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`v1_token ${r.status}`);

  const j: V1AccessTokenResp = await r.json();
  const token = j?.response?.access_token;
  if (!token) throw new Error('v1_token_missing');
  return token;
}

export type V1Payment = {
  imp_uid: string;
  merchant_uid: string;
  status: 'ready' | 'paid' | 'failed' | 'cancelled';
  amount: number;
  currency: string; // 'KRW'
  fail_reason?: string;
};

export async function getV1Payment(impUid: string, token: string): Promise<V1Payment> {
  const r = await fetch(`https://api.iamport.kr/payments/${impUid}`, {
    // V1: Authorization 헤더에 토큰 그대로 넣습니다 (Bearer 아님)
    headers: { Authorization: token },
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`v1_payment ${r.status}`);
  const j = await r.json();
  const p = j?.response;
  if (!p) throw new Error('payment_not_found');
  return p as V1Payment;
}
