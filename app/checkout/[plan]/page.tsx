// app/checkout/[plan]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { requestIamportPay } from "@/lib/portone/v1-client";

type PlanId = "START_OS" | "SIGNATURE_OS" | "MASTER_OS";

export default function CheckoutPlanPage() {
  const { plan } = useParams<{ plan: PlanId }>();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) 세션/uid 쿠키 보정
      const ensure = await fetch("/api/session/ensure", {
        method: "GET",
        credentials: "include",
      });
      if (cancelled) return;
      if (ensure.status === 401) {
        const next = encodeURIComponent(`/checkout/${plan}`);
        router.replace(`/auth/sign-in?next=${next}`);
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [plan, router]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      // 2) 주문 생성
      const res = await fetch("/api/checkout/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan }),
      });

      if (cancelled) return;

      if (!res.ok) {
        console.error("failed to start checkout", await res.text());
        alert("주문 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      const { merchantUid, amount, orderName } = await res.json();

      // 3) 아임포트 v1 결제 호출
      await requestIamportPay({
        merchant_uid: merchantUid,
        amount,
        name: orderName,
      });
      // PC에선 콜백에서 완료 페이지로 이동, 모바일은 m_redirect_url로 이동
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, plan]);

  return null; // 필요하면 로딩 UI 구성
}
