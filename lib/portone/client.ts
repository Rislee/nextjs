// lib/portone/client.ts
'use client';

/**
 * PortOne v1 (iamport.js) 클라이언트 래퍼
 * - storeId 요구 X
 * - IMP.request_pay 사용
 * - 채널키(channelKey)는 있으면 전달, 없어도 동작
 */

declare global {
  interface Window {
    IMP?: any;
  }
}

type RequestArgs = {
  paymentId: string;     // merchant_uid
  orderName: string;     // name
  amount: number;        // amount (숫자)
  redirectUrl: string;   // m_redirect_url
  channelKey?: string;   // 선택: 콘솔의 채널키
  buyer?: {
    email?: string;
    name?: string;
    tel?: string;
    addr?: string;
    postcode?: string;
  };
};

const IMP_SRC = 'https://cdn.iamport.kr/v1/iamport.js';
const IMP_CODE = process.env.NEXT_PUBLIC_IAMPORT_CODE;            // 예: imp00000000
const DEFAULT_CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY; // 선택

async function loadIamport(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('client only');

  if (!window.IMP) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = IMP_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('iamport.js load failed'));
      document.head.appendChild(s);
    });
  }

  const IMP = window.IMP;
  if (!IMP) throw new Error('IMP not available');

  // 고객사 식별코드가 있으면 초기화
  if (IMP_CODE) {
    try { IMP.init(IMP_CODE); } catch {}
  }

  return IMP;
}

/** 결제창 호출 */
export async function requestPortOnePayment(args: RequestArgs): Promise<void> {
  const IMP = await loadIamport();

  const channelKey = args.channelKey ?? DEFAULT_CHANNEL_KEY;

  const params: any = {
    // v1 공통 파라미터
    merchant_uid: args.paymentId,
    name: args.orderName,
    amount: args.amount,
    pay_method: 'card',
    // 모바일 리다이렉트용
    m_redirect_url: args.redirectUrl,
  };

  // 채널키가 있으면 포함 (콘솔 연동정보 사용 시 권장)
  if (channelKey) params.channelKey = channelKey;

  // 구매자 정보(선택)
  if (args.buyer) {
    const { email, name, tel, addr, postcode } = args.buyer;
    if (email) params.buyer_email = email;
    if (name) params.buyer_name = name;
    if (tel) params.buyer_tel = tel;
    if (addr) params.buyer_addr = addr;
    if (postcode) params.buyer_postcode = postcode;
  }

  // Promise 형태로 감싸서 에러 처리 단순화
  await new Promise<void>((resolve, reject) => {
    try {
      IMP.request_pay(params, (rsp: any) => {
        // 리다이렉트 모드면 콜백이 안 올 수도 있음 (모바일 등)
        if (rsp && rsp.error_code) {
          reject(new Error(rsp.error_msg || 'payment_failed'));
        } else {
          resolve();
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}
