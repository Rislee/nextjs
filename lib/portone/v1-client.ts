// lib/portone/v1-client.ts
declare global { interface Window { IMP?: any } }

type PayArgs = {
  merchant_uid: string;
  name: string;
  amount: number;
  redirectUrl: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_tel?: string;
  pay_method?: 'card' | 'trans' | 'vbank' | 'phone';
  pg?: string; // PG사 선택 파라미터 추가
};

export async function requestIamportPay({ 
  merchant_uid, 
  name, 
  amount, 
  redirectUrl,
  buyer_name,
  buyer_email,
  buyer_tel,
  pay_method = 'card',
  pg = 'settle' // 기본값은 settle
}: PayArgs) {
  const IMP = window.IMP;
  if (!IMP) throw new Error('IMP SDK not loaded');

  const impCode =
    process.env.NEXT_PUBLIC_IMP_CODE ||
    process.env.NEXT_PUBLIC_IAMPORT_CODE;
  if (!impCode) throw new Error('Missing NEXT_PUBLIC_IMP_CODE (or NEXT_PUBLIC_IAMPORT_CODE)');

  IMP.init(impCode);

  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  return new Promise<void>((resolve, reject) => {
    IMP.request_pay(
      {
        pg, // PG사 동적 설정
        pay_method,
        merchant_uid,
        name,
        amount,
        buyer_name,
        buyer_email,
        buyer_tel,
        m_redirect_url: redirectUrl,
        digital: true,
        confirm_url: `${window.location.origin}/api/webhook/portone`,
      },
      (rsp: any) => {
        if (rsp?.success) resolve();
        else reject(new Error(rsp?.error_msg || 'pay_failed'));
      }
    );
  });
}