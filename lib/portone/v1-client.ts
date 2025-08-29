// lib/portone/v1-client.ts
declare global { interface Window { IMP?: any } }

type PayArgs = {
  merchant_uid: string;
  name: string;
  amount: number;
  redirectUrl: string; // 모바일용 리다이렉트
};

export async function requestIamportPay({ merchant_uid, name, amount, redirectUrl }: PayArgs) {
  const IMP = window.IMP;
  if (!IMP) throw new Error('IMP SDK not loaded');

  const impCode = process.env.NEXT_PUBLIC_IMP_CODE!;
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
        if (rsp.success) resolve();
        else reject(new Error(rsp.error_msg || 'pay_failed'));
      }
    );
  });
}
