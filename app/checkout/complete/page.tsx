'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function Page() {
  return (
    <Suspense fallback={<div>결제 상태 확인 중…</div>}>
      <Content />
    </Suspense>
  );
}

function Content() {
  const sp = useSearchParams();
  const impUid = sp.get('imp_uid') ?? '';
  const merchantUid = sp.get('merchant_uid') ?? '';
  const success = sp.get('success') ?? '';

  const [verifyMsg, setVerifyMsg] = useState('검증 대기중…');

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
        if (j?.ok) setVerifyMsg('검증 OK');
        else setVerifyMsg(`검증 실패: ${j?.error ?? r.status}`);
      } catch (e: any) {
        setVerifyMsg(`검증 실패: ${e?.message ?? 'unknown'}`);
      }
    })();
  }, [impUid, merchantUid]);

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
