"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function Page() {
  return (
    <Suspense fallback={<div>결제 상태 확인 중…</div>}>
      <Content />
    </Suspense>
  );
}

function Content() {
  const sp = useSearchParams();
  const [verifyMsg, setVerifyMsg] = useState<string>("");

  // v2(권장): paymentId/txId
  // 레거시: merchant_uid/imp_uid/success도 일단 표시
  const paymentId = sp.get("paymentId") ?? sp.get("merchant_uid") ?? "";
  const txId = sp.get("txId") ?? sp.get("imp_uid") ?? "";
  const success = sp.get("success") ?? "";

  const hasId = useMemo(() => Boolean(paymentId), [paymentId]);

  useEffect(() => {
    // (선택) 서버 검증 라우트로 전송 → 멤버십 상태 갱신
    if (!hasId) return;
    (async () => {
      try {
        const r = await fetch("/api/checkout/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId }),
        });
        const j = await r.json();
        if (r.ok && j?.ok) setVerifyMsg("결제 검증 완료. 멤버십이 활성화되었습니다.");
        else setVerifyMsg(`검증 실패: ${j?.error || r.statusText}`);
      } catch (e: any) {
        setVerifyMsg(`검증 호출 실패: ${e?.message || e}`);
      }
    })();
  }, [hasId, paymentId]);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">결제 완료</h1>

      <div className="mt-3 text-sm text-gray-600 space-y-1">
        <div>paymentId: {paymentId || "-"}</div>
        <div>txId: {txId || "-"}</div>
        <div>success: {success || "-"}</div>
        {verifyMsg && <div className="mt-2 text-green-700">{verifyMsg}</div>}
      </div>
    </main>
  );
}
