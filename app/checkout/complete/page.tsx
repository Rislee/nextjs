// app/checkout/complete/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

type PlanId = 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS';

function inferPlanFromMerchant(merchantUid: string | null): PlanId | null {
  if (!merchantUid) return null;
  if (merchantUid.includes('MASTER_OS')) return 'MASTER_OS';
  if (merchantUid.includes('SIGNATURE_OS')) return 'SIGNATURE_OS';
  if (merchantUid.includes('START_OS')) return 'START_OS';
  return null;
}

function Content() {
  const sp = useSearchParams();
  const router = useRouter();

  const impUid = sp.get('imp_uid');
  const merchantUid = sp.get('merchant_uid');
  const success = sp.get('success') === 'true';

  const plan = useMemo<PlanId | null>(() => inferPlanFromMerchant(merchantUid), [merchantUid]);
  const nextUrl = useMemo(() => (plan ? `/${plan.split('_')[0].toLowerCase()}` : '/'), [plan]);

  const [status, setStatus] = useState<'idle'|'verifying'|'ok'|'error'>('idle');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    (async () => {
      setStatus('verifying');
      try {
        const res = await fetch('/api/checkout/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ impUid, merchantUid }),
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || 'verify_failed');
        }
        setStatus('ok');
        // 검증 성공 즉시 이동
        router.replace(nextUrl);
      } catch (e: any) {
        setStatus('error');
        setMessage(e?.message ?? String(e));
      }
    })();
  }, [impUid, merchantUid, nextUrl, router]);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">결제 완료 확인</h1>
      <dl className="mt-4 text-sm">
        <dt className="text-gray-500">imp_uid</dt><dd className="mb-2">{impUid || '-'}</dd>
        <dt className="text-gray-500">merchant_uid</dt><dd className="mb-2">{merchantUid || '-'}</dd>
        <dt className="text-gray-500">success</dt><dd className="mb-2">{String(success)}</dd>
      </dl>

      {status === 'verifying' && <p className="mt-4">검증 중…</p>}
      {status === 'error' && <p className="mt-4 text-red-600">검증 실패: {message}</p>}
      {status === 'ok' && <p className="mt-4">검증 성공! 곧 이동합니다…</p>}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => location.reload()}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          새로고침
        </button>
        <button
          type="button"
          onClick={() => router.replace(nextUrl)}
          className="text-blue-600 hover:underline text-sm"
        >
          {plan ? `${plan} 페이지로 이동` : '홈으로 이동'}
        </button>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">결제 상태 확인 중…</div>}>
      <Content />
    </Suspense>
  );
}
