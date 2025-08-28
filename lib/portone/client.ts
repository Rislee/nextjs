// lib/portone/client.ts
// 브라우저에서 PortOne 결제요청을 안전하게 호출하는 래퍼

export type PlanId = "START_OS" | "SIGNATURE_OS" | "MASTER_OS";

export type StartResponse = {
  ok: true;
  merchantUid: string;       // 서버에서 생성한 결제ID (= paymentId)
  orderName: string;
  amount: number;
  currency: "KRW";
} | {
  ok: false;
  error: string;
};

type RequestArgs = {
  planId: PlanId;
  paymentId: string;         // = merchantUid
  orderName: string;
  amount: number;
  currency: "KRW";
  redirectUrl: string;
  storeId: string;
  channelKey?: string;
  env?: "sandbox" | "production";
};

function assertBrowser() {
  if (typeof window === "undefined") {
    throw new Error("PortOne 결제는 브라우저에서만 호출하세요.");
  }
}

function ensureSDK(): any {
  assertBrowser();
  const sdk = (window as any).PortOne;
  if (!sdk) throw new Error("PortOne SDK가 로드되지 않았습니다. layout.tsx의 <Script>를 확인해주세요.");
  return sdk;
}

/**
 * PortOne 결제 호출
 * PC: IFRAME → Promise resolve 후 우리가 수동으로 redirect
 * Mobile: REDIRECTION → SDK가 자동으로 redirect (우리는 추가 동작 없음)
 */
export async function requestPortOnePayment(args: RequestArgs) {
  const {
    paymentId, orderName, amount, currency,
    redirectUrl, storeId, channelKey, env = "sandbox",
  } = args;

  const sdk = ensureSDK();

  const payload: any = {
    storeId,
    paymentId,
    orderName,
    totalAmount: amount,
    currency,
    payMethod: "CARD",
    redirectUrl, // 모바일 REDIRECTION에서 필수
    windowType: { pc: "IFRAME", mobile: "REDIRECTION" },
    env,
  };
  if (channelKey) payload.channelKey = channelKey;

  // 디버깅 로그
  // eslint-disable-next-line no-console
  console.log("[PortOne payload]", payload);

  try {
    const res = await sdk.requestPayment(payload);

    // PC IFRAME의 정상 완료 케이스: res 안에 paymentId/txId 포함
    if (res && (res.paymentId || res.txId)) {
      const u = new URL(redirectUrl);
      // v2 기준: paymentId/txId 기반으로 서버 검증 가능
      if (res.paymentId) u.searchParams.set("paymentId", String(res.paymentId));
      if (res.txId) u.searchParams.set("txId", String(res.txId));
      // 레거시 호환(혹시나)
      u.searchParams.set("merchant_uid", String(res.paymentId ?? paymentId));
      u.searchParams.set("success", "true");
      window.location.assign(u.toString());
      return;
    }

    // 모바일 REDIRECTION이면 SDK가 알아서 이동 → 우리는 할 일 없음
    // 혹은 특정 PG에서 res가 비어올 수도 있으니, 안전망으로 2초 뒤 강제 이동
    setTimeout(() => {
      const u = new URL(redirectUrl);
      u.searchParams.set("paymentId", paymentId);
      window.location.assign(u.toString());
    }, 2000);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("PortOne requestPayment error:", err);
    alert(`결제 오류: ${err?.message || "요청 실패"}`);
  }
}
