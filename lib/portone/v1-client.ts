// lib/portone/v1-client.ts
type PayParams = {
  merchant_uid: string;
  amount: number;
  name: string;
};

declare global {
  interface Window {
    IMP?: any;
  }
}

async function loadIamport() {
  if (typeof window === "undefined") return;
  if (window.IMP) return;

  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.iamport.kr/v1/iamport.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("IMP SDK load failed"));
    document.head.appendChild(s);
  });

  if (!window.IMP) {
    throw new Error("IMP SDK not loaded");
  }
}

function gotoCompleteFromCallback(rsp: any) {
  const base =
    process.env.NEXT_PUBLIC_PORTONE_REDIRECT_URL || "/checkout/complete";
  const url = new URL(base, window.location.origin);

  if (rsp.imp_uid) url.searchParams.set("imp_uid", String(rsp.imp_uid));
  if (rsp.merchant_uid)
    url.searchParams.set("merchant_uid", String(rsp.merchant_uid));

  // 성공 키를 두 가지 모두 세팅(환경별 차이 흡수)
  const success = !!rsp.success;
  url.searchParams.set("imp_success", String(success));
  url.searchParams.set("success", String(success));

  if (rsp.error_msg) url.searchParams.set("error_msg", String(rsp.error_msg));

  window.location.replace(url.toString());
}

export async function requestIamportPay(p: PayParams) {
  await loadIamport();

  const IMP = window.IMP!;
  const impCode =
    process.env.NEXT_PUBLIC_IMP_CODE ||
    (process.env as any).NEXT_PUBLIC_IAMPORT_CODE; // 하위 호환

  if (!impCode) throw new Error("Missing NEXT_PUBLIC_IMP_CODE");

  IMP.init(impCode);

  const params = {
    pg: "settle", // 헥토(SETTLE)
    pay_method: "card",
    merchant_uid: p.merchant_uid,
    name: p.name,
    amount: p.amount,
    m_redirect_url:
      process.env.NEXT_PUBLIC_PORTONE_REDIRECT_URL ||
      `${window.location.origin}/checkout/complete`,
  };

  return new Promise<void>((resolve, reject) => {
    IMP.request_pay(params, (rsp: any) => {
      try {
        // PC 웹에선 여기 콜백으로 들어옴 → 우리가 완료 페이지로 이동시키며 쿼리 세팅
        gotoCompleteFromCallback(rsp);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });
}
