'use client';

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { requestIamportPay } from "@/lib/portone/v1-client";
import type { PlanId } from "@/lib/plan";
import { hasAccessOrHigher } from "@/lib/plan";

export default function CheckoutPlanPage() {
  const { plan } = useParams<{ plan: PlanId }>();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

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

      // 2) 활성 멤버십이면 즉시 대시보드로 이동
      const { data: membership } = await supabase
        .from("memberships")
        .select("plan_id,status")
        .maybeSingle();

      if (membership?.status === "active" && membership?.plan_id && hasAccessOrHigher(membership.plan_id as PlanId, plan)) {
        router.replace("/dashboard");
        return;
      }

      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [plan, router, supabase]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    (async () => {
      // 3) 주문 생성
      const res = await fetch("/api/checkout/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan }),
      });

      if (cancelled) return;

      // 서버에서도 재결제 차단: 409면 대시보드로
      if (res.status === 409) {
        router.replace("/dashboard");
        return;
      }
      if (!res.ok) {
        console.error("failed to start checkout", await res.text());
        alert("주문 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      const { merchantUid, amount, orderName } = await res.json();

      // 4) 아임포트 v1 결제 호출
      await requestIamportPay({ merchant_uid: merchantUid, amount, name: orderName });
    })();

    return () => { cancelled = true; };
  }, [ready, plan, router]);

  return null;
}
