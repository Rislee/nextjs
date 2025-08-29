// app/checkout/complete/CompleteClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type VerifyResponse = {
  ok: boolean;
  status?: string;
  amount?: number | null;
  currency?: string;
  failure?: { reason?: string; pgCode?: string; pgMessage?: string } | null;
  error?: string;
};

// 성공 시 이동할 곳 (원하면 Vercel에 NEXT_PUBLIC_AFTER_SUCCESS_URL 설정)
const TARGET_AFTER_SUCCESS =
  process.env.NEXT_PUBLIC_AFTER_SUCCESS_URL ?? "https://www.inneros.co.kr";

export default function CompleteClient() {
  const sp = useSearchParams();

  // PortOne v2 및 호환 파라미터들
  const paymentId = useMemo(
    () =>
      sp.get("paymentId") ||
      sp.get("merchant_uid") ||
      sp.get("imp_uid") ||
      "",
    [sp]
  );
  const txId = useMemo(
    () => sp.get("transactionId") || sp.get("txId") || sp.get("txid") || "",
    [sp]
  );
  const success = sp.get("success");

  const [verify, setVerify] = useState<VerifyResponse | null>(null);
  const [msg, setMsg] = useState<string>("");

  // 성공 시 자동 리다이렉션 카운트다운
  const [countdown, setCountdown] = useState<number | null>(null);

  // 서버 검증
  useEffect(() => {
    (async () => {
      if (!paymentId) {
        setMsg("paymentId 없음");
        return;
      }
      try {
        const r = await fetch("/api/checkout/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId, merchantUid: paymentId }),
        });
        const j: VerifyResponse = await r.json();
        setVerify(j);
        if (!j.ok) setMsg(j.error || "검증 실패");
      } catch (e: any) {
        setMsg(e?.message || "검증 요청 실패");
      }
    })();
  }, [paymentId]);

  // 검증 OK면 자동 이동
  useEffect(() => {
    if (!verify?.ok) return;
    setCountdown(2); // 2초 뒤 이동
    let left = 2;
    const iv = setInterval(() => {
      left -= 1;
      setCountdown(left);
      if (left <= 0) {
        clearInterval(iv);
        location.replace(TARGET_AFTER_SUCCESS);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [verify?.ok]);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">결제 완료</h1>

      <div className="mt-3 text-sm text-gray-700">
        <div>paymentId: {paymentId || "-"}</div>
        <div>txId: {txId || "-"}</div>
        <div>success: {String(success ?? "-")}</div>
      </div>

      {/* 검증 결과 */}
      {!verify && !msg && (
        <p className="mt-4 text-sm text-gray-500">검증 중…</p>
      )}

      {verify?.ok && (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          <div className="font-medium">검증 OK</div>
          <div className="mt-1">
            {verify.amount != null && (
              <span>
                결제금액: {verify.amount.toLocaleString()} {verify.currency || "KRW"}
              </span>
            )}
          </div>
          <div className="mt-2">
            {countdown !== null ? (
              <span>
                {countdown}초 후 계속합니다…{" "}
                <button
                  className="ml-2 underline"
                  onClick={() => location.replace(TARGET_AFTER_SUCCESS)}
                >
                  바로 이동
                </button>
              </span>
            ) : (
              <button
                className="underline"
                onClick={() => location.replace(TARGET_AFTER_SUCCESS)}
              >
                계속하기
              </button>
            )}
          </div>
        </div>
      )}

      {verify && !verify.ok && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <div className="font-medium">검증 실패</div>
          <div className="mt-1">status: {verify.status || "-"}</div>
          {verify.failure && (
            <div className="mt-1 text-red-600">
              <div>사유: {verify.failure.reason || verify.failure.pgMessage || "-"}</div>
              {verify.failure.pgCode && <div>코드: {verify.failure.pgCode}</div>}
            </div>
          )}
          {verify.error && <div className="mt-1">에러: {verify.error}</div>}

          <button
            className="mt-3 rounded-md border px-3 py-2 text-xs hover:bg-gray-50"
            onClick={() => (location.href = "/checkout")}
          >
            다시 결제하기
          </button>
        </div>
      )}

      {!!msg && !verify?.ok && (
        <p className="mt-3 text-xs text-gray-500">세부: {msg}</p>
      )}
    </main>
  );
}
