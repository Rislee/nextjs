'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function Page() {
  return (
    <Suspense fallback={<div>결제 상태 확인 중…</div>}>
      <Content />
    </Suspense>
  );
}

type PlanId = 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS';

function Content() {
  const sp = useSearchParams();
  const router = useRouter();

  const impUid = sp.get('imp_uid') ?? '';
  const merchantUid = sp.get('merchant_uid') ?? '';
  const success = sp.get('success') ?? ''; // 일부 PG는 success 쿼리를 같이 붙여줌(true/false)

  const [verifyMsg, setVerifyMsg] = useState('검증 대기중…');
  const [verifying, setVerifying] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // merchant_uid 예: inneros_START_OS_1756441617463
  const planFromMerchant = useMemo<PlanId | undefined>(() => {
    const parts = (merchantUid || '').split('_'); // ['inneros','START_OS','1756...']
    const p = parts[1];
    return (p === 'START_OS' || p === 'SIGNATURE_OS' || p === 'MASTER_OS') ? p : undefined;
  }, [merchantUid]);

  const nextUrl = useMemo(() => {
    switch (planFromMerchant) {
      case 'START_OS':     return '/start';
      case 'SIGNATURE_OS': return '/signature';
      case 'MASTER_OS':    return '/master';
      default:             return '/';
    }
  }, [planFromMerchant]);

  const doVerify = useCallback(async () => {
    if (!impUid || !merchantUid) {
      setVerifyMsg('파라미터 누락(imp_uid 또는 merchant_uid)');
      return;
    }
    setVerifying(true);
    setVerifyMsg('결제 검증 중…');

    try {
      const r = await fetch('/api/checkout/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ✅ V1 검증: impUid(=imp_uid) + merchantUid
        body: JSON.stringify({ impUid, merchantUid }),
        cache: 'no-store',
      });

      // 실패 응답도 본문을 안전하게 읽기
      const raw = await r.text();
      let json: any = null;
      try { json = raw ? JSON.parse(raw) : null; } catch { /* ignore */ }

      if (r.ok && json?.ok) {
        setVerifyMsg('검증 OK — 잠시 후 이동합니다…');
        if (redirectTimer.current) clearTimeout(redirectTimer.current);
        redirectTimer.current = setTimeout(() => {
          router.replace(nextUrl);
        }, 1200);
      } else {
        const err = json?.error ?? `verify ${r.status}${raw ? `: ${raw}` : ''}`;
        setVerifyMsg(`검증 실패: ${err}`);
      }
    } catch (e: any) {
      setVerifyMsg(`검증 실패: ${e?.message ?? 'unknown'}`);
    } finally {
      setVerifying(false);
    }
  }, [impUid, merchantUid, nextUrl, router]);

  useEffect(() => {
    // 사용자가 결제창에서 취소했거나 PG 쪽에서 실패를 success=false로 내려준 경우
    if (success && success.toLowerCase() === 'false') {
      setVerifyMsg('결제가 완료되지 않았습니다(취소/실패).');
      return;
    }
    // 정상 진행: 자동 검증
    void doVerify();

    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [success, doVerify]);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">결제 완료</h1>
      <div className="mt-3 text-sm text-gray-600 space-y-1">
        <div>imp_uid: {impUid || '-'}</div>
        <div>merchant_uid: {merchantUid || '-'}</div>
        <div>success: {success || '-'}</div>

        <div className="mt-3 font-medium">{verifyMsg}</div>

        <div className="mt-4 flex gap-8 items-center">
          <button
            type="button"
            onClick={doVerify}
            disabled={verifying}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {verifying ? '검증 중…' : '검증 다시 시도'}
          </button>

          {/* 검증 성공시 즉시 이동하고 싶을 때 */}
          <button
            type="button"
            onClick={() => router.replace(nextUrl)}
            className="text-blue-600 hover:underline text-sm"
          >
            지금 이동
          </button>
        </div>
      </div>
    </main>
  );
}
