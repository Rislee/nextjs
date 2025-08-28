'use client';

import { Suspense, useEffect } from 'react';
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

  const impUid = sp.get('imp_uid');
  const merchantUid = sp.get('merchant_uid');
  const success = sp.get('success');

  useEffect(() => {
    // 필요 시 결제 검증 호출
    // fetch('/api/webhook/portone/verify', { method: 'POST', body: JSON.stringify({ impUid, merchantUid }) })
  }, [impUid, merchantUid]);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">결제 완료</h1>
      <div className="mt-3 text-sm text-gray-500">
        <div>imp_uid: {impUid ?? '-'}</div>
        <div>merchant_uid: {merchantUid ?? '-'}</div>
        <div>success: {success ?? '-'}</div>
      </div>
    </main>
  );
}
