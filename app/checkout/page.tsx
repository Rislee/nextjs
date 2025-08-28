'use client';

import { useState } from 'react';

declare global { interface Window { PortOne: any } }

async function waitForPortOne() {
  const t0 = Date.now();
  while (!window.PortOne?.requestPayment) {
    if (Date.now() - t0 > 5000) throw new Error('PortOne SDK load timeout');
    await new Promise(r => setTimeout(r, 50));
  }
  return window.PortOne;
}

type PlanId = 'START_OS'|'SIGNATURE_OS'|'MASTER_OS';

export default function CheckoutPage() {
  const [loading, setLoading] = useState<PlanId|null>(null);
  const [msg, setMsg] = useState('');

  async function pay(planId: PlanId) {
    try {
      setLoading(planId);
      setMsg('');

      // ✅ 서버가 쿠키(uid)로 사용자 식별 → 클라는 planId만 보냄
      const res = await fetch('/api/checkout/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
        credentials: 'include'
      });

      if (!res.ok) {
        const t = await res.text().catch(()=>'');
        throw new Error(`start ${res.status}${t ? `: ${t}` : ''}`);
      }
      const { ok, merchantUid, amount, currency, orderName } = await res.json();
      if (!ok) throw new Error('start not ok');

      const PortOne = await waitForPortOne();

      const storeId     = process.env.NEXT_PUBLIC_PORTONE_STORE_ID!;
      const channelKey  = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
      const redirectUrl = process.env.NEXT_PUBLIC_PORTONE_REDIRECT_URL!;

      await PortOne.requestPayment({
        storeId,                 // ✅ 최상위
        channelKey,              // (선택)
        paymentId: merchantUid,
        orderName,
        totalAmount: amount,
        currency: currency || 'KRW',
        payMethod: 'CARD',
        redirectUrl
      });
      // 이후 PortOne이 redirectUrl로 이동
    } catch (e: any) {
      console.error(e);
      setMsg(`결제 오류: ${e?.message ?? e}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">멤버십 결제</h1>
      <p className="mt-2 text-sm text-gray-500">플랜을 선택하세요.</p>

      <div className="mt-6 grid gap-3">
        <button disabled={!!loading} onClick={() => pay('START_OS')}>
          {loading === 'START_OS' ? '진행 중…' : 'Start OS 결제'}
        </button>
        <button disabled={!!loading} onClick={() => pay('SIGNATURE_OS')}>
          {loading === 'SIGNATURE_OS' ? '진행 중…' : 'Signature OS 결제'}
        </button>
        <button disabled={!!loading} onClick={() => pay('MASTER_OS')}>
          {loading === 'MASTER_OS' ? '진행 중…' : 'Master OS 결제'}
        </button>
      </div>

      {!!msg && <p className="mt-3 text-sm text-red-500">{msg}</p>}
    </main>
  );
}
