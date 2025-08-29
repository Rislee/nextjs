'use client';

import { useState } from 'react';
import { requestHectoCardPay } from '@/lib/portone/hecto';

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
    return json as { ok: true; merchantUid: string; amount: number; orderName: string };
  }

  async function pay(planId: PlanId) {
    try {
      setLoading(planId); setMsg('');
      const { merchantUid, amount, orderName } = await startOrder(planId);

      // TODO: 실제 사용자 정보 연결(헥토는 전화번호 필수)
      const buyerTel = '010-0000-0000';

      const rsp = await requestHectoCardPay({
        merchantUid,
        orderName,
        amount,
        buyer: { tel: buyerTel },
      });

      // 데스크탑 콜백 대비 완료 페이지로 이동
      const u = new URL('/checkout/complete', location.origin);
      u.searchParams.set('imp_uid', String(rsp.imp_uid || ''));
      u.searchParams.set('merchant_uid', String(rsp.merchant_uid || merchantUid));
      u.searchParams.set('success', 'true');
      location.href = u.toString();
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? String(e));
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
