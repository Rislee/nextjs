// lib/portone/client.ts
// 브라우저에서 PortOne 결제창을 여는 얇은 래퍼

declare global {
  interface Window {
    PortOne?: {
      requestPayment: (payload: any) => Promise<any>;
    };
  }
}

export type RequestArgs = {
  paymentId: string;         // 주문(결제) 식별자 = merchantUid
  orderName: string;         // 주문명
  // 금액은 두 키 중 아무거나 써도 됨 (amount 또는 totalAmount)
  amount?: number;
  totalAmount?: number;

  currency?: string;         // 기본: 'KRW'
  payMethod?: 'CARD' | string; // 기본: 'CARD'
  redirectUrl: string;       // 결제 완료 후 돌아올 URL
};

/** PortOne 스크립트가 로드되어 있고, window.PortOne 이 있는지 확인 */
function ensurePortOne() {
  if (typeof window === 'undefined') {
    throw new Error('PortOne SDK must run in the browser.');
  }
  if (!window.PortOne || typeof window.PortOne.requestPayment !== 'function') {
    throw new Error('window.PortOne is not available. Did you load the PortOne script?');
  }
  return window.PortOne;
}

/** 환경변수 체크 (클라이언트에서 NEXT_PUBLIC_* 로 읽음) */
function getEnv() {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
  if (!storeId) throw new Error('Missing NEXT_PUBLIC_PORTONE_STORE_ID');
  // 채널키는 PG에 따라 필수일 수 있음 → 있으면 붙이고, 없으면 생략 가능하도록 처리
  return { storeId, channelKey };
}

export async function requestPortOnePayment(args: RequestArgs) {
  const PortOne = ensurePortOne();
  const { storeId, channelKey } = getEnv();

  const total = args.totalAmount ?? args.amount;
  if (typeof total !== 'number' || !isFinite(total)) {
    throw new Error('Invalid amount / totalAmount');
  }

  // PortOne 브라우저 SDK 페이로드 (v2 스펙과 호환)
  const payload: any = {
    storeId,
    paymentId: args.paymentId,
    orderName: args.orderName,
    totalAmount: total,                      // PortOne은 totalAmount 키를 사용
    currency: args.currency ?? 'KRW',
    redirectUrl: args.redirectUrl,
  };
  if (args.payMethod) payload.payMethod = args.payMethod;
  if (channelKey) payload.channelKey = channelKey;

  if (process.env.NODE_ENV !== 'production') {
    // 디버깅 로그 (민감정보 없음)
    // eslint-disable-next-line no-console
    console.log('[PortOne payload]', payload);
  }

  // 결제창 호출
  return await PortOne.requestPayment(payload);
}
