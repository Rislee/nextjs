"use client";

import { useState } from "react";
declare global { interface Window { PortOne: any } }

export default function CheckoutPage() {
  const [loading, setLoading] = useState(false);

  async function pay(planId: "START_OS" | "SIGNATURE_OS" | "MASTER_OS") {
    try {
      setLoading(true);

      const userId = "163fdf19-3041-49ce-91f7-975f29665481"; // 로그인 연동 후 교체
      const start = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planId }),
      }).then(r => r.json());

      if (!start?.ok) throw new Error(start?.error ?? "checkout start failed");

      const PortOne = (window as any).PortOne;
      if (!PortOne?.requestPayment) {
        alert("결제 SDK가 아직 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId: start.merchant_uid,
        orderName: `${start.plan.name} 1개월`,
        totalAmount: start.amount,
        currency: start.currency, // "KRW"
        payMethod: "CARD",
        redirectUrl: process.env.NEXT_PUBLIC_PORTONE_REDIRECT_URL!,
        noticeUrls: [`${process.env.SITE_URL}/api/webhook/portone`], // 선택
      });
    } catch (e: any) {
      alert(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 12 }}>
      <h1>구독 결제</h1>
      <button disabled={loading} onClick={() => pay("START_OS")}>Start OS 결제</button>
      <button disabled={loading} onClick={() => pay("SIGNATURE_OS")}>Signature OS 결제</button>
      <button disabled={loading} onClick={() => pay("MASTER_OS")}>Master OS 결제</button>
    </main>
  );
}
