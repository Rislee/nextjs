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
        // 1) 서버에서 주문 생성 (POST 필수)
        const res = await fetch('/api/checkout/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // uid 쿠키 포함
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

        // 2) PortOne v1 결제창 호출 (currency/payMethod/totalAmount/ storeId 없이)
        await requestPortOnePayment({
          paymentId:  merchantUid,
          orderName:  orderName,
          amount:     amount, // 숫자
          redirectUrl: 'https://account.inneros.co.kr/checkout/complete',
          // channelKey: 필요 시 옵션으로 추가 가능
        });

        // 결제 완료 후에는 redirectUrl로 이동함
      } catch (e: any) {
        console.error(e);
        setMsg('오류');
        setSubmsg(String(e?.message ?? e));
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
