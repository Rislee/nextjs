// app/checkout/complete/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">결제 상태 확인 중…</div>}>
      <CompleteClient />
    </Suspense>
  );
}

function CompleteClient() {
  const sp = useSearchParams();
  const [state, setState] = useState<'checking' | 'success' | 'fail'>('checking');
  const [msg, setMsg] = useState('');

  // v2 우선 + v1 호환 (모두 커버)
  const paymentId =
    sp.get('paymentId') ||          // PortOne v2
    sp.get('merchant_uid') ||       // v1 호환
    sp.get('payment_id') ||         // 혹시 모를 대체 키
    sp.get('imp_uid') ||            // v1 고유 ID
    '';

  // 실패/취소 시 쿼리로 오는 값들(있으면 화면 표시용)
  const successParam = sp.get('success'); // 'true' | 'false' (있을 수도, 없을 수도)
  const code = sp.get('code') || sp.get('errorCode');
  const message = sp.get('message') || sp.get('error_msg');

  // 쿼리 전체를 보고 싶으면 열어보기(디버그용)
  const allQuery = useMemo(() => {
    const obj: Record<string, string> = {};
    sp.forEach((v, k) => (obj[k] = v));
    return obj;
  }, [sp]);

  useEffect(() => {
    // 결제 식별자 없으면 더 진행 불가
    if (!paymentId) {
      setState('fail');
      setMsg('결제 식별자(paymentId)가 없습니다.');
      return;
    }

    // 쿼리에 성공=false가 명시되면 바로 실패 처리(사용자 취소 등)
    if (successParam === 'false') {
      setState('fail');
      setMsg(message ? `결제 취소: ${message}` : '결제가 취소되었습니다.');
      return;
    }

    // 서버에 검증 요청 (uid 쿠키로 사용자 식별)
    (async () => {
      try {
        const r = await fetch('/api/checkout/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ paymentId }),
        });

        const raw = await r.text();
        let j: any = null;
        try { j = raw ? JSON.parse(raw) : null; } catch { /* ignore */ }

        if (!r.ok || !j?.ok) throw new Error(j?.error || `verify ${r.status}`);

        setState('success');
        setMsg('결제가 완료되었습니다. 멤버십이 활성화되었어요.');
      } catch (e: any) {
        setState('fail');
        setMsg(e?.message ?? String(e));
      }
    })();
  }, [paymentId, successParam, message]);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">결제 결과</h1>

      <div className="mt-3 text-sm text-gray-500 space-y-1">
        <div>paymentId: {paymentId || '-'}</div>
        {typeof successParam === 'string' && <div>success: {successParam}</div>}
        {code && <div>code: {code}</div>}
        {message && <div>message: {message}</div>}
      </div>

      <div className="mt-6">
        {state === 'checking' && <p>서버에서 결제 검증 중…</p>}
        {state === 'success' && <p className="text-green-600">{msg}</p>}
        {state === 'fail' && <p className="text-red-600">검증 실패: {msg}</p>}
      </div>

      {/* 디버그가 필요하면 주석 해제
      <pre className="mt-6 text-xs bg-gray-50 p-3 rounded">{JSON.stringify(allQuery, null, 2)}</pre>
      */}
    </main>
  );
}
