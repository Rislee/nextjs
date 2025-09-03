// lib/portone/v1-client.ts - 주문자 정보 포함
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
};

export async function requestIamportPay({ 
  merchant_uid, 
  name, 
  amount, 
  redirectUrl,
  buyer_name,
  buyer_email,
  buyer_tel,
  pay_method = 'card'
}: PayArgs) {
  const IMP = window.IMP;
  if (!IMP) throw new Error('IMP SDK not loaded');

  // BOTH 지원: NEXT_PUBLIC_IMP_CODE / NEXT_PUBLIC_IAMPORT_CODE
  const impCode =
    process.env.NEXT_PUBLIC_IMP_CODE ||
    process.env.NEXT_PUBLIC_IAMPORT_CODE;
  if (!impCode) throw new Error('Missing NEXT_PUBLIC_IMP_CODE (or NEXT_PUBLIC_IAMPORT_CODE)');

  IMP.init(impCode);

  await new Promise<void>((resolve) => setTimeout(resolve, 0)); // 이벤트 루프 1틱 양보(안전)

  return new Promise<void>((resolve, reject) => {
    IMP.request_pay(
      {
        pg: 'settle',
        pay_method,
        merchant_uid,
        name,
        amount,
        buyer_name,
        buyer_email,
        buyer_tel,
        m_redirect_url: redirectUrl, // 모바일 리다이렉트
        // 추가 옵션들
        digital: true, // 디지털 상품
        confirm_url: `${window.location.origin}/api/webhook/portone`, // 웹훅 URL
      },
      (rsp: any) => {
        if (rsp?.success) resolve();
        else reject(new Error(rsp?.error_msg || 'pay_failed'));
      }
    );
  });
}