// lib/portone/client.ts
'use client';

// PortOne v2 브라우저 SDK는 레이아웃에서 로드되어야 합니다.
// <Script src="https://cdn.portone.io/v2/browser-sdk.js" strategy="afterInteractive" />

declare global {
  interface Window {
    PortOne?: { requestPayment: (payload: any) => Promise<any> };
  }
}

type Sdk = { requestPayment: (payload: any) => Promise<any> };

function getPortOne(): Sdk {
  // 전역에서 SDK 안전 추출
  const sdk = (globalThis as any)?.PortOne;
  if (!sdk || typeof sdk.requestPayment !== 'function') {
    throw new Error('PortOne SDK not loaded');
  }
  return sdk as Sdk;
}

export type CheckoutPayloadBase = {
  paymentId: string;
  orderName: string;
  totalAmount: number;
  currency: string;              // 'KRW'
  payMethod: 'CARD' | string;
  redirectUrl?: string;          // 비워도 아래에서 보강
  env?: 'sandbox' | 'production' | 'development';
  customer?: {
    customerId?: string;
    fullName?: string;
    email?: string;
    phoneNumber?: string;
  };
};

// 브라우저 호출 입력
export type CheckoutInput = CheckoutPayloadBase & {
  storeId?: string;              // 없으면 ENV에서 보강
  channelKey?: string;           // 기본 채널 없으면 필수
};

export async function requestPortOnePayment(input: CheckoutInput) {
  const sdk = getPortOne();

  const storeId    = input.storeId    ?? process.env.NEXT_PUBLIC_PORTONE_STORE_ID!;
  const channelKey = input.channelKey ?? process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? undefined;

  // 브라우저에서 현재 도메인으로 폴백
  const runtimeOrigin = (globalThis as any)?.location?.origin || '';

  const redirectUrl =
    input.redirectUrl
    ?? process.env.NEXT_PUBLIC_PORTONE_REDIRECT_URL
    ?? (runtimeOrigin ? `${runtimeOrigin}/checkout/complete` : '');

  const env =
    (input.env ?? (process.env.NEXT_PUBLIC_PORTONE_ENV as any) ?? 'sandbox') as
      | 'sandbox' | 'production' | 'development';

  if (!storeId)    throw new Error('storeId missing');
  if (!redirectUrl) throw new Error('redirectUrl missing');

  const payload = {
    storeId,
    ...(channelKey ? { channelKey } : {}),
    paymentId:   input.paymentId,
    orderName:   input.orderName,
    totalAmount: input.totalAmount,
    currency:    input.currency,
    payMethod:   input.payMethod,
    redirectUrl,
    env,
    ...(input.customer ? { customer: input.customer } : {}),
  };

  // 디버그
  // eslint-disable-next-line no-console
  console.log('[PortOne payload]', payload);

  return sdk.requestPayment(payload);
}
