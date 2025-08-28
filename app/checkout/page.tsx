"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    PortOne: any;
  }
}

type PlanId = "START_OS" | "SIGNATURE_OS" | "MASTER_OS";

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastMsg, setLastMsg] = useState("");

  // ✅ 웹훅 반영을 폴링해서 멤버십 활성화되면 수동 이동
  async function waitUntilPaid(userId: string, merchantUid: string) {
  setChecking(true);
  setLastMsg("결제 완료 감지 중… (최대 20초)");

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch("/api/membership/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) continue;
      const j = await res.json();

      // 여기 조건을 당신의 DB 상태값에 맞게 조정
      const status = j?.data?.status;
      if (j?.ok && (status === "active" || status === "trialing")) {
        setLastMsg("권한 활성화 완료! 이동합니다…");
        router.replace(`/checkout/complete?result=success&merchant_uid=${encodeURIComponent(merchantUid)}`);
        return;
      }
    } catch {
      // 일시 오류 무시 후 재시도
    }
  }

  setChecking(false);
  setLastMsg("권한 활성화 확인에 시간이 걸리고 있습니다. 잠시 후 새로고침해 주세요.");
}


  async function pay(planId: PlanId) {
    const userId = "163fdf19-3041-49ce-91f7-975f29665481"; // 로그인 연동 후 교체
    try {
      setLoading(planId);
      setLastMsg("");

      // 1) 서버에서 주문 생성
      const res = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planId }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`checkout/start ${res.status}: ${text.slice(0, 200)}`);
      }

      const start = await res.json();
      if (!start?.ok) throw new Error(start?.error ?? "checkout start failed");

      // 2) PortOne v2 호출 (토스: PC는 IFRAME 권장 / 모바일은 REDIRECTION 권장)
      const PortOne = (window as any).PortOne;
      if (!PortOne?.requestPayment) {
        throw new Error("결제 SDK가 아직 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.");
      }

      await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY!,
        paymentId: start.merchant_uid,
        orderName: `${start.plan.name} 1개월`,
        totalAmount: start.amount,
        currency: start.currency, // "KRW"
        payMethod: "CARD",
        redirectUrl: process.env.NEXT_PUBLIC_PORTONE_REDIRECT_URL!, // 절대 URL 필요
        windowType: {
          pc: "IFRAME",        // ✅ 토스 권장: PC=IFRAME
          mobile: "REDIRECTION",
        },
        // noticeUrls: [`${process.env.NEXT_PUBLIC_SITE_URL}/api/webhook/portone`], // 필요시만
      });

      // 3) IFRAME 모드에서는 부모창이 이동하지 않으므로, 웹훅 반영을 폴링하여 수동 이동
      await waitUntilPaid(userId, start.merchant_uid);
    } catch (e: any) {
      console.error(e);
      setLastMsg(e?.message ?? String(e));
      alert(e?.message ?? String(e));
    } finally {
      setLoading(null);
    }
  }

  
  return (
    <main style={{ padding: 24, display: "grid", gap: 12 }}>
      <h1>구독 결제</h1>

      <div style={{ display: "grid", gap: 8, maxWidth: 360 }}>
        <button disabled={!!loading || checking} onClick={() => pay("START_OS")}>
          {loading === "START_OS" ? "진행 중…" : "Start OS 결제"}
        </button>
        <button disabled={!!loading || checking} onClick={() => pay("SIGNATURE_OS")}>
          {loading === "SIGNATURE_OS" ? "진행 중…" : "Signature OS 결제"}
        </button>
        <button disabled={!!loading || checking} onClick={() => pay("MASTER_OS")}>
          {loading === "MASTER_OS" ? "진행 중…" : "Master OS 결제"}
        </button>
      </div>

      {checking && <p style={{ color: "#6b7280" }}>{lastMsg}</p>}
    </main>
  );
}
