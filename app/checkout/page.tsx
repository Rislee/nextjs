// app/checkout/page.tsx
'use client';

import { useState } from 'react';
import { requestPortOnePayment } from '@/lib/portone/client';

type PlanId = 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS';

const PLAN_LABEL: Record<PlanId, string> = {
  START_OS: 'Start OS 결제',
  SIGNATURE_OS: 'Signature OS 결제',
  MASTER_OS: 'Master OS 결제',
};

export default function CheckoutPage() {
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [msg, setMsg] = useState('');

  async function startOrder(planId: PlanId) {
    const res = await fetch('/api/checkout/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',               // 🔒 uid 쿠키 포함
      body: JSON.stringify({ planId }),
    });

    // 실패 응답도 내용 확인 (빈 바디 방지)
    const raw = await res.text();
    let json: any = null;
    try { json = raw ? JSON.parse(raw) : null; } catch { /* ignore */ }

    if (!res.ok || !json?.ok) {
      const err = json?.error ?? `start ${res.status}${raw ? `: ${raw}` : ''}`;
      throw new Error(err);
    }
    return json as {
      ok: true;
      merchantUid: string;
      amount: number;
      currency: string;
      orderName: string;
    };
  }

  async function pay(planId: PlanId) {
    try {
      setLoading(planId);
      setMsg('');

      // 1) 주문 생성(서버가 쿠키 uid로 사용자 식별)
      const { merchantUid, amount, currency, orderName } = await startOrder(planId);

      // 2) PortOne 브라우저 SDK 호출 (클라이언트 래퍼)
      await requestPortOnePayment({
        paymentId:   merchantUid,
        orderName:   orderName,
        totalAmount: amount,
        currency:    currency || 'KRW',
        payMethod:   'CARD',
        //redirectUrl: '',
        // customer: { customerId: '원하면추가' }
      });

      // 이후 PortOne이 redirectUrl로 이동합니다.
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? String(e));
      // 401이면 로그인 만료 가능성 → 사인인으로 유도
      if (String(e?.message || '').includes('unauthorized')) {
        setMsg('로그인이 필요합니다. 다시 로그인 해주세요.');
        // location.href = 'https://account.inneros.co.kr/auth/sign-in';
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">멤버십 결제</h1>
      <p className="mt-2 text-sm text-gray-500">플랜을 선택하세요.</p>

      <div className="mt-6 grid gap-3">
        {(Object.keys(PLAN_LABEL) as PlanId[]).map((id) => (
          <button
            key={id}
            onClick={() => pay(id)}
            disabled={!!loading}
            className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
            aria-busy={loading === id}
          >
            {loading === id ? '진행 중…' : PLAN_LABEL[id]}
          </button>
        ))}
      </div>

      {!!msg && <p className="mt-4 text-sm text-red-500">{msg}</p>}
    </main>
  );
}
