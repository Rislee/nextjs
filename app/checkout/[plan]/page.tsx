'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { requestPortOnePayment } from '@/lib/portone/client';

// 사용 가능한 플랜
type PlanId = 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS';

const LABEL: Record<PlanId, string> = {
  START_OS: 'InnerOS Start OS',
  SIGNATURE_OS: 'InnerOS Signature OS',
  MASTER_OS: 'InnerOS Master OS',
};

export default function CheckoutPlanPage() {
  const { plan } = useParams<{ plan: string }>();
  const router = useRouter();
  const [msg, setMsg] = useState('결제 준비 중…');

  const planId = useMemo<PlanId | null>(() => {
    const p = String(plan || '').toUpperCase();
    return (['START_OS', 'SIGNATURE_OS', 'MASTER_OS'] as const).includes(p as PlanId)
      ? (p as PlanId)
      : null;
  }, [plan]);

  // 서버에 주문 생성 요청
  async function startOrder(selected: PlanId) {
    const res = await fetch('/api/checkout/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ planId: selected }),
    });

    // 안전한 에러 메시지 파싱
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
      currency?: string;
      orderName: string;
    };
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!planId) {
        setMsg('잘못된 플랜입니다.');
        return;
      }

      try {
        setMsg('주문 생성 중…');

        const { merchantUid, amount, currency, orderName } = await startOrder(planId);
        if (cancelled) return;

        setMsg('결제창 호출 중…');

        // PortOne 결제창 호출
        await requestPortOnePayment({
          paymentId:   merchantUid,
          orderName:   orderName || LABEL[planId],
          amount,                              // ✅ totalAmount → amount 로 변경
          currency:    currency ?? 'KRW',      // RequestArgs가 string 허용하도록 되어 있어야 함
          payMethod:   'CARD',
          redirectUrl: 'https://account.inneros.co.kr/checkout/complete',
        });

        // 결제창으로 제어가 넘어감 (redirectUrl로 돌아옴)
        } catch (e: any) {
        console.error(e);
        const message = String(e?.message || e || 'unknown');

         if (message.includes('unauthorized') || message.includes('401')) {
            const here = typeof window !== 'undefined' ? window.location.href : `/checkout/${planId}`;

            // ✅ 보조용 쿠키 저장 (10분)
           const sameSite = 'Lax';
          const domain =
            typeof window !== 'undefined' && location.hostname.endsWith('inneros.co.kr')
              ? 'Domain=.inneros.co.kr; '
                : '';
           document.cookie = `returnTo=${encodeURIComponent(here)}; ${domain}Path=/; Max-Age=600; SameSite=${sameSite}`;

            // ✅ next 파라미터도 함께 전달
           window.location.href = `/auth/sign-in?next=${encodeURIComponent(here)}`;
          return;
        }

  setMsg(`오류: ${message}`);
}
    })();

    return () => { cancelled = true; };
  }, [planId]);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">결제 진행</h1>
      <p className="mt-2 text-sm text-gray-600">
        {planId ? `${LABEL[planId]} 결제를 준비하고 있어요.` : '플랜 식별 실패'}
      </p>

      <div className="mt-4 text-sm text-gray-500">{msg}</div>

      <div className="mt-6">
        <button
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
          onClick={() => router.push('/checkout')}
        >
          다른 플랜 선택
        </button>
      </div>
    </main>
  );
}
