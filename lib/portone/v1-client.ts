// lib/portone/v1-client.ts
declare global { interface Window { IMP?: any } }

type PayArgs = {
  merchant_uid: string;
  name: string;
  amount: number;
  redirectUrl: string; // 모바일 완료 후 이동
};

export async function requestIamportPay({ merchant_uid, name, amount, redirectUrl }: PayArgs) {
  const IMP = (typeof window !== 'undefined') ? window.IMP : undefined;
  if (!IMP) throw new Error('IMP SDK not loaded');

  const impCode = process.env.NEXT_PUBLIC_IMP_CODE || process.env.NEXT_PUBLIC_IAMPORT_CODE;
  if (!impCode) throw new Error('Missing NEXT_PUBLIC_IMP_CODE');

  IMP.init(impCode);

  return new Promise<void>((resolve, reject) => {
    IMP.request_pay(
      {
        pg: 'settle',            // ✅ 헥토파이낸셜(카드)
        pay_method: 'card',      // 카드 결제
        merchant_uid,
        name,
        amount,
        m_redirect_url: redirectUrl, // 모바일에서 완료 후 이동
      },
      (rsp: any) => {
        if (rsp && rsp.success) resolve();
        else reject(new Error((rsp && rsp.error_msg) || 'pay_failed'));
      }
    );
  });
}
