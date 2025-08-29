// lib/portone/hecto.ts
declare global { interface Window { IMP?: any } }

function loadIamport(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.IMP) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.iamport.kr/v1/iamport.js"; // PortOne V1 SDK
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

type Buyer = {
  email?: string;
  name?: string;
  tel: string; // ⚠️ 헥토 필수
  addr?: string;
  postcode?: string;
};

export async function requestHectoCardPay(args: {
  merchantUid: string;
  orderName: string;
  amount: number;
  buyer: Buyer;
}) {
  await loadIamport();
  const IMP = window.IMP!;
  IMP.init(process.env.NEXT_PUBLIC_IAMPORT_CODE); // impXXXXXXXX

  return new Promise<any>((resolve, reject) => {
    IMP.request_pay(
      {
        channelKey: process.env.NEXT_PUBLIC_HECTO_CHANNEL_KEY, // 헥토 채널키
        pay_method: "card",
        merchant_uid: args.merchantUid,
        name: args.orderName,
        amount: args.amount,
        buyer_email: args.buyer.email,
        buyer_name: args.buyer.name,
        buyer_tel: args.buyer.tel, // ⚠️ 필수
        buyer_addr: args.buyer.addr,
        buyer_postcode: args.buyer.postcode,
        m_redirect_url:
          `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://account.inneros.co.kr"}/checkout/complete`,
      },
      (rsp: any) => {
        // rsp: { success, imp_uid, merchant_uid, error_msg, ... }
        if (rsp?.success === false || rsp?.error_code) {
          return reject(new Error(rsp?.error_msg || "결제 실패"));
        }
        resolve(rsp);
      }
    );
  });
}
