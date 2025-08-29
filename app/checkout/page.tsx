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
      credentials: 'include',
      body: JSON.stringify({ planId }),
    });

    const raw = await res.text();
    let json: any = null;
    try { json = raw ? JSON.parse(raw) : null; } catch {}

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

      // 0) 세션 쿠키 보강(로그인 직후 안전망)
      await fetch('/api/session/ensure', { method: 'POST', credentials: 'include' }).catch(() => {});

      // 1) 서버에서 주문 생성
      const { merchantUid, amount, currency, orderName } = await startOrder(planId);

      // 2) PortOne 브라우저 SDK 호출 (명시적 전달)
      await requestPortOnePayment({
        planId,
        paymentId:   merchantUid,
        orderName:   orderName,
        amount:      amount,                // ✅ RequestArgs.amount (totalAmount 아님)
        currency:    (currency ?? 'KRW'),
        redirectUrl: 'https://account.inneros.co.kr/checkout/complete',
        env:         (process.env.NEXT_PUBLIC_PORTONE_ENV as 'sandbox' | 'production') || 'sandbox',
        storeId:     process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,                // ✅ 명시
        channelKey:  process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || undefined, // (기본 채널 없으면 필수)
      });

      // 이후 REDIRECTION or 폴백 리다이렉션으로 완료 페이지 이동
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? String(e));
      if (String(e?.message || '').includes('unauthorized')) {
        setMsg('로그인이 필요합니다. 다시 로그인 해주세요.');
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
