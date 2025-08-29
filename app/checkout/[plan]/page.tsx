// app/checkout/[plan]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { requestPortOnePayment } from '@/lib/portone/client';

type PlanId = 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS';

export default function CheckoutPlanPage() {
  const params = useParams<{ plan: string }>();
  const router = useRouter();
  const planId = useMemo<PlanId | null>(() => {
    const p = (params?.plan || '').toUpperCase();
    return (['START_OS', 'SIGNATURE_OS', 'MASTER_OS'] as const).includes(p as any)
      ? (p as PlanId)
      : null;
  }, [params?.plan]);

  const [msg, setMsg] = useState('결제 진행');
  const [submsg, setSubmsg] = useState('플랜 결제를 준비하고 있어요…');

  useEffect(() => {
    (async () => {
      if (!planId) {
        setMsg('오류');
        setSubmsg('잘못된 플랜입니다.');
        return;
      }
      try {
        // 1) 서버에서 주문 생성
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

        const { merchantUid, amount, orderName } = json as {
          ok: true; merchantUid: string; amount: number; orderName: string;
        };

        // 2) 포트원 결제창 띄우기
        await requestPortOnePayment({
          paymentId: merchantUid,
          orderName,
          amount,
          currency: 'KRW',
          redirectUrl: 'https://account.inneros.co.kr/checkout/complete',
        });

        // 결제창에서 완료되면 redirectUrl로 이동함
      } catch (e: any) {
        console.error(e);
        setMsg('오류');
        setSubmsg(String(e?.message ?? e));
        // 401이면 로그인 만료일 가능성이 큼 → 로그인 페이지로 보낼지 선택
        if (String(e?.message || '').includes('unauthorized')) {
          router.replace(`/auth/sign-in?next=/checkout/${planId}`);
        }
      }
    })();
  }, [planId, router]);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">{msg}</h1>
      <p className="mt-2 text-sm text-gray-600">{submsg}</p>
    </main>
  );
}
