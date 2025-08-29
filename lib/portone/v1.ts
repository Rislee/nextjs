// lib/portone/v1.ts
type GetTokenResp = {
  code: number;
  message?: string | null;
  response?: { access_token: string; now: number; expired_at: number };
};

type PaymentResp = {
  code: number;
  message?: string | null;
  response?: {
    imp_uid: string;
    merchant_uid: string;
    status: 'ready' | 'paid' | 'failed' | 'cancelled';
    amount: number;
    currency: 'KRW' | string;
    // 필요 시 필드 추가
  };
};

export async function getV1AccessToken() {
  const imp_key = process.env.PORTONE_V1_API_KEY!;
  const imp_secret = process.env.PORTONE_V1_API_SECRET!;
  const r = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imp_key, imp_secret }),
    cache: 'no-store',
  });
  const data: GetTokenResp = await r.json();
  if (!r.ok || data.code !== 0 || !data.response?.access_token) {
    throw new Error(`getToken failed: ${data.message ?? r.statusText}`);
  }
  return data.response.access_token;
}

export async function getV1Payment(impUid: string, accessToken: string) {
  const r = await fetch(`https://api.iamport.kr/payments/${impUid}`, {
    headers: { Authorization: accessToken },
    cache: 'no-store',
  });
  const data: PaymentResp = await r.json();
  if (!r.ok || data.code !== 0 || !data.response) {
    throw new Error(`getPayment failed: ${data.message ?? r.statusText}`);
  }
  return data.response;
}
