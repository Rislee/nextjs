// lib/portone/client.ts
'use client';

// 브라우저에서만 import!
// layout.tsx 에서 SDK 로드 필요:
// <Script src="https://cdn.portone.io/v2/browser-sdk.js" strategy="afterInteractive" />

declare global {
  interface Window {
    PortOne?: { requestPayment: (payload: any) => Promise<any> };
  }
}

type Sdk = { requestPayment: (payload: any) => Promise<any> };

function getPortOne(): Sdk {
  // 전역에서 SDK 안전히 조회
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
  currency: string;          // 'KRW'
  payMethod: 'CARD' | string;
  redirectUrl: string;
  env?: 'sandbox' | 'production' | 'development';
  customer?: { customerId?: string; fullName?: string; email?: string; phoneNumber?: string };
};

export type CheckoutInput = CheckoutPayloadBase & {
  storeId?: string;      // 없으면 env에서 보강
  channelKey?: string;   // 선택 (기본 채널 없으면 필수)
};

export async function requestPortOnePayment(input: CheckoutInput) {
  const sdk = getPortOne();

  const storeId     = input.storeId    ?? process.env.NEXT_PUBLIC_PORTONE_STORE_ID!;
  const channelKey  = input.channelKey ?? process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
  const redirectUrl = input.redirectUrl ?? process.env.NEXT_PUBLIC_PORTONE_REDIRECT_URL!;
  const env = (input.env ?? (process.env.NEXT_PUBLIC_PORTONE_ENV as any) ?? 'sandbox') as
    | 'sandbox' | 'production' | 'development';

  if (!storeId) throw new Error('storeId missing');
  if (!redirectUrl) throw new Error('redirectUrl missing');

  // ✅ 절대 { data: ... }로 감싸지 말 것!
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

  // 디버그용
  // eslint-disable-next-line no-console
  console.log('[PortOne payload]', payload);

  return sdk.requestPayment(payload);
}
