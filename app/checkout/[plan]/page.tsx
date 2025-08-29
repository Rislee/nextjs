// app/checkout/[plan]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { requestIamportPay } from '@/lib/portone/v1-client';

type PlanId = 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS';

export default function CheckoutPlanPage() {
  const params = useParams<{ plan: string }>();
  const router = useRouter();

  const planId = useMemo<PlanId | null>(() => {
    const p = String(params?.plan || '').toUpperCase();
    return (['START_OS', 'SIGNATURE_OS', 'MASTER_OS'] as const).includes(p as any) ? (p as PlanId) : null;
  }, [params?.plan]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!planId) {
        setError('잘못된 플랜입니다.');
        return;
      }
      try {
        setLoading(true);
        const res = await fetch('/api/checkout/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ planId }),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || 'checkout_start_failed');
        }
        const { merchantUid, amount, orderName } = json as { merchantUid: string; amount: number; orderName: string };

        const redirectUrl =
          process.env.NEXT_PUBLIC_PORTONE_REDIRECT_URL ||
          'https://account.inneros.co.kr/checkout/complete';

        await requestIamportPay({
          merchant_uid: merchantUid,
          name: orderName,
          amount,
          redirectUrl,
        });

        // PC 환경에서는 콜백이 여기로 돌아오므로 완료 페이지로 픽스드 이동
        const u = new URL(redirectUrl);
        u.searchParams.set('imp_uid', '');
        u.searchParams.set('merchant_uid', merchantUid);
        u.searchParams.set('success', 'true');
        router.replace(u.toString());
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [planId, router]);

  if (!planId) {
    return <main className="mx-auto max-w-xl p-6">잘못된 경로입니다.</main>;
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">결제 준비 중…</h1>
      <p className="mt-2 text-sm text-gray-600">플랜: <strong>{planId}</strong></p>
      {loading && <p className="mt-4 text-sm">결제창을 여는 중…</p>}
      {error && <p className="mt-4 text-sm text-red-600">오류: {error}</p>}
    </main>
  );
}
