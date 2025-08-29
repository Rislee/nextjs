'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function Page() {
  return (
    <Suspense fallback={<div>결제 상태 확인 중…</div>}>
      <Content />
    </Suspense>
  );
}

function Content() {
  const sp = useSearchParams();
  const router = useRouter();

  const impUid = sp.get('imp_uid') ?? '';
  const merchantUid = sp.get('merchant_uid') ?? '';
  const success = sp.get('success') ?? '';

  const [verifyMsg, setVerifyMsg] = useState('검증 대기중…');

  // merchantUid 예: inneros_START_OS_1756441617463
  const planFromMerchant = useMemo(() => {
    const parts = (merchantUid || '').split('_'); // ['inneros', 'START_OS', '1756...']
    return (parts[1] as 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS' | undefined) ?? undefined;
  }, [merchantUid]);

  const nextUrl = useMemo(() => {
    switch (planFromMerchant) {
      case 'START_OS':     return '/start';
      case 'SIGNATURE_OS': return '/signature';
      case 'MASTER_OS':    return '/master';
      default:             return '/';
    }
  }, [planFromMerchant]);

  useEffect(() => {
    (async () => {
      if (!impUid || !merchantUid) { setVerifyMsg('파라미터 누락'); return; }
      try {
        const r = await fetch('/api/checkout/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ impUid, merchantUid }),
        });
        const j = await r.json();

        if (j?.ok) {
          setVerifyMsg('검증 OK — 잠시 후 이동합니다…');
          // 1.2초 후 플랜별 페이지로 이동 (가드 미들웨어가 접근권한 체크)
          setTimeout(() => router.replace(nextUrl), 1200);
        } else {
          setVerifyMsg(`검증 실패: ${j?.error ?? r.status}`);
        }
      } catch (e: any) {
        setVerifyMsg(`검증 실패: ${e?.message ?? 'unknown'}`);
      }
    })();
  }, [impUid, merchantUid, nextUrl, router]);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">결제 완료</h1>
      <div className="mt-3 text-sm text-gray-600 space-y-1">
        <div>imp_uid: {impUid || '-'}</div>
        <div>merchant_uid: {merchantUid || '-'}</div>
        <div>success: {success || '-'}</div>
        <div className="mt-2 font-medium">{verifyMsg}</div>
      </div>
    </main>
  );
}
