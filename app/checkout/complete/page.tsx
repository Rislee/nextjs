'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Status = 'idle' | 'verifying' | 'paid' | 'ready' | 'cancelled' | 'failed' | 'error';

function parsePlanFromMerchantUid(merchantUid?: string | null) {
  // 예: inneros_START_OS_1756482141340
  const m = (merchantUid || '').match(/^inneros_(START_OS|SIGNATURE_OS|MASTER_OS)_/);
  return (m?.[1] as 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS' | null) ?? null;
}

// Next 내부 라우트(브릿지)로만 이동 → 미들웨어/게이트 통과
function planToPath(plan: 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS' | null) {
  if (!plan) return '/dashboard';
  if (plan === 'START_OS') return '/start';
  if (plan === 'SIGNATURE_OS') return '/signature';
  return '/master';
}

function CompleteInner() {
  const sp = useSearchParams();
  const router = useRouter();

  // 완료 페이지 유입 파라미터 (PC/모바일 모두 대응)
  const impUid = sp.get('imp_uid') || '';               // 없을 수 있음(취소 등)
  const merchantUid = sp.get('merchant_uid') || '';     // 거의 항상 옴
  const successParam = (sp.get('imp_success') ?? sp.get('success')) === 'true';
  const errorMsg = sp.get('error_msg') || '';

  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');
  const [tries, setTries] = useState(0);
  const busyRef = useRef(false);

  const plan = useMemo(() => parsePlanFromMerchantUid(merchantUid), [merchantUid]);

  const verifyOnce = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStatus('verifying');
    try {
      const res = await fetch('/api/checkout/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ impUid, merchantUid }),
      });
      const data = await res.json();

      if (!res.ok) {
        // 서버에서 명시적 에러 메시지
        setStatus('error');
        setMessage(data?.error || '검증 실패');
        return;
      }

      const s = (data.updatedStatus || data.iamportStatus || '').toLowerCase() as Status;

      if (s === 'paid') {
        setStatus('paid');
        // 멤버십이 활성화되었으므로 상품 페이지(브릿지)로 이동
        router.replace(planToPath(plan));
        return;
      }

      if (s === 'ready') {
        setStatus('ready');
        setMessage('결제 진행 중입니다. 잠시만 기다려 주세요…');
        return;
      }

      if (s === 'cancelled') {
        setStatus('cancelled');
        setMessage('결제가 취소되었습니다.');
        return;
      }

      // 그 외는 실패로 처리
      setStatus('failed');
      setMessage('결제에 실패했습니다.');
    } catch (e: any) {
      setStatus('error');
      setMessage(e?.message || '검증 중 오류가 발생했습니다.');
    } finally {
      busyRef.current = false;
    }
  }, [impUid, merchantUid, plan, router]);

  // 최초 진입 시 검증 1회
  useEffect(() => {
    // 사용자가 결제창에서 "취소"한 경우 success=false로 들어올 수 있음
    // 그래도 서버 검증을 호출해 status를 명확히 판단
    verifyOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ready 상태면 짧게 재시도 (최대 3번, 4~5초 간격)
  useEffect(() => {
    if (status !== 'ready' || tries >= 3) return;
    const t = setTimeout(async () => {
      setTries((n) => n + 1);
      await verifyOnce();
    }, 5000);
    return () => clearTimeout(t);
  }, [status, tries, verifyOnce]);

  const retryVerify = async () => {
    setTries(0);
    await verifyOnce();
  };

  const goDashboard = () => router.replace('/dashboard');
  const retryCheckout = () => {
    if (plan) router.replace(`/checkout/${plan}`);
    else router.replace('/dashboard');
  };

  // 간단한 UI
  return (
    <main className="mx-auto max-w-md p-6 text-sm">
      {status === 'verifying' || status === 'idle' ? (
        <p>결제 검증 중…</p>
      ) : null}

      {status === 'paid' ? (
        <p>결제가 완료되어 이용 페이지로 이동합니다…</p>
      ) : null}

      {status === 'ready' ? (
        <div>
          <p className="mb-2">{message || '결제 확인 중입니다.'}</p>
          <button onClick={retryVerify} className="rounded border px-3 py-1 hover:bg-gray-50">
            다시 확인
          </button>
        </div>
      ) : null}

      {status === 'cancelled' ? (
        <div className="space-y-3">
          <p className="text-red-600">{message || '결제가 취소되었습니다.'}</p>
          <div className="flex gap-2">
            <button onClick={retryCheckout} className="rounded border px-3 py-1 hover:bg-gray-50">
              다시 결제하기
            </button>
            <button onClick={goDashboard} className="rounded border px-3 py-1 hover:bg-gray-50">
              대시보드
            </button>
          </div>
          {errorMsg ? <p className="text-xs text-gray-500">사유: {errorMsg}</p> : null}
        </div>
      ) : null}

      {status === 'failed' || status === 'error' ? (
        <div className="space-y-3">
          <p className="text-red-600">{message || '결제에 실패했습니다.'}</p>
          <div className="flex gap-2">
            <button onClick={retryCheckout} className="rounded border px-3 py-1 hover:bg-gray-50">
              다시 결제하기
            </button>
            <button onClick={goDashboard} className="rounded border px-3 py-1 hover:bg-gray-50">
              대시보드
            </button>
            <button onClick={retryVerify} className="rounded border px-3 py-1 hover:bg-gray-50">
              검증 재시도
            </button>
          </div>
        </div>
      ) : null}

      {/* 디버깅 보조 */}
      <div className="mt-6 space-y-1 text-xs text-gray-500 break-all">
        <div>success(param): {String(successParam)}</div>
        <div>imp_uid: {impUid || '(없음)'}</div>
        <div>merchant_uid: {merchantUid || '(없음)'}</div>
        <div>plan: {plan || '(파싱 실패)'}</div>
        <div>tries: {tries}</div>
        <div>status: {status}</div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="p-6 text-sm">결제 검증 페이지 로딩…</main>}>
      <CompleteInner />
    </Suspense>
  );
}
