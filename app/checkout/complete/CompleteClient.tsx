// app/checkout/complete/CompleteClient.tsx  (✅ 클라이언트)
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function CompleteClient() {
  const sp = useSearchParams();
  const paymentId =
    sp.get("paymentId") ||
    sp.get("merchant_uid") ||
    sp.get("imp_uid") ||
    "";
  const txId =
    sp.get("transactionId") ||
    sp.get("txId") ||
    sp.get("txid") ||
    "";
  const success = sp.get("success");

  const [msg, setMsg] = useState("");
  const [verify, setVerify] = useState<any>(null);

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
        const j = await r.json();
        setVerify(j);
        if (!j.ok) setMsg(j.error || "검증 실패");
      } catch (e: any) {
        setMsg(e?.message || "검증 요청 실패");
      }
    })();
  }, [paymentId]);

  return (
    <main style={{ padding: 24 }}>
      <h1>결제 완료</h1>
      <p>paymentId: {paymentId || "-"}</p>
      <p>txId: {txId || "-"}</p>
      <p>success: {String(success ?? "-")}</p>

      {msg && <p style={{ color: "limegreen" }}>검증 실패: {msg}</p>}
      {verify?.ok && <p style={{ color: "dodgerblue" }}>검증 OK</p>}
    </main>
  );
}
