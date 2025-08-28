"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    PortOne: any;
  }
}

type PlanId = "START_OS" | "SIGNATURE_OS" | "MASTER_OS";

async function waitForPortOne() {
  const begin = Date.now();
  while (!window.PortOne?.requestPayment) {
    if (Date.now() - begin > 5000) throw new Error("PortOne SDK load timeout");
    await new Promise(r => setTimeout(r, 50));
  }
  return window.PortOne;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastMsg, setLastMsg] = useState("");

  async function pay(planId: PlanId) {
    try {
      setLoading(planId);

      // (예시) 로그인한 유저 식별자
      const userRes = await fetch("/api/membership/status", { method: "POST" });
      const userJson = await userRes.json();
      const userId = userJson?.userId;
      if (!userId) throw new Error("No userId");

      // 1) 서버에서 주문정보 받아오기
      const res = await fetch("/api/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planId }),
      });
      if (!res.ok) throw new Error(`checkout/start ${res.status}`);
      const { ok, merchantUid, amount, currency, orderName } = await res.json();
      if (!ok) throw new Error("start not ok");

      // 2) PortOne 결제창 열기 (✅ storeId는 최상위!)
      const PortOne = await waitForPortOne();
      const redirectUrl = process.env.NEXT_PUBLIC_PORTONE_REDIRECT_URL!;
      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID!;
      const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

      await PortOne.requestPayment({
        storeId,              // ✅ 최상위
        channelKey,           // (선택)
        paymentId: merchantUid,
        orderName,
        totalAmount: amount,
        currency: currency || "KRW",
        payMethod: "CARD",
        redirectUrl,          // e.g., https://account.inneros.co.kr/checkout/complete
        env: process.env.NEXT_PUBLIC_PORTONE_ENV || "sandbox", // (선택)
        customer: {
          customerId: userId,
        },
      });

      // 3) 결제 후엔 PortOne이 redirectUrl로 이동시킴
    } catch (e: any) {
      console.error(e);
      setLastMsg(`결제 오류: ${e?.message ?? e}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">멤버십 결제</h1>
      <p className="mt-2 text-sm text-gray-500">플랜을 선택하세요.</p>

      <div className="mt-6 grid gap-3">
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

      {lastMsg && <p className="mt-3 text-sm text-red-500">{lastMsg}</p>}
    </main>
  );
}
