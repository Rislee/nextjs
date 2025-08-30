// app/checkout/[plan]/page.tsx (교체)
'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { requestIamportPay } from "@/lib/portone/v1-client";
import type { PlanId } from "@/lib/plan";
import { hasAccessOrHigher } from "@/lib/plan";

type Stage = "checking" | "signin" | "eligible" | "starting" | "paying" | "done" | "error";

export default function CheckoutPlanPage() {
  const { plan } = useParams<{ plan: PlanId }>();
  const router = useRouter();

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  const [stage, setStage] = useState<Stage>("checking");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const loginUrl = useMemo(
    () => `/auth/sign-in?next=${encodeURIComponent(`/checkout/${plan}`)}`,
    [plan]
  );

  const checkAndProceed = useCallback(async () => {
    try {
      setStage("checking");
      setErrorMsg("");

      // 세션 확인 (5초 타임아웃)
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), 5000);
      const ensure = await fetch("/api/session/ensure", {
        method: "GET",
        credentials: "include",
        signal: ac.signal,
      }).catch((e) => {
        throw new Error(e?.name === "AbortError" ? "세션 확인 타임아웃" : e?.message);
      });
      clearTimeout(tid);

      if (ensure.status === 401) {
        setStage("signin"); // 🔸 자동 이동 없음 — 버튼만 표시
        return;
      }

      // 활성 멤버십이면 대시보드로
      const { data: membership } = await supabase
        .from("memberships")
        .select("plan_id,status")
        .maybeSingle();

      if (membership?.status === "active" && membership?.plan_id && hasAccessOrHigher(membership.plan_id as PlanId, plan)) {
        router.replace("/dashboard");
        return;
      }

      setStage("eligible");
    } catch (e: any) {
      setErrorMsg(e?.message || "초기 확인 중 오류가 발생했습니다.");
      setStage("error");
    }
  }, [plan, router, supabase]);

  useEffect(() => {
    checkAndProceed();
  }, [checkAndProceed]);

  const startOrderAndPay = useCallback(async () => {
    try {
      setErrorMsg("");
      setStage("starting");

      const res = await fetch("/api/checkout/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan }),
      });

      if (res.status === 409) {
        router.replace(`/dashboard?notice=already-active&target=${plan}`);
        return;
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`주문 생성 실패 (${res.status}) ${txt}`);
      }

      const { merchantUid, amount, orderName } = await res.json();

      setStage("paying");
      await requestIamportPay({ merchant_uid: merchantUid, amount, name: orderName });

      setStage("done");
    } catch (e: any) {
      setErrorMsg(e?.message || "결제창 호출에 실패했습니다.");
      setStage("error");
    }
  }, [plan, router]);

  useEffect(() => {
    if (stage !== "eligible") return;
    const t = setTimeout(() => { startOrderAndPay(); }, 300);
    return () => clearTimeout(t);
  }, [stage, startOrderAndPay]);

  return (
    <main className="mx-auto max-w-md p-6 text-sm">
      {stage === "checking" && <p>사용자 확인 중…</p>}

      {stage === "signin" && (
        <div className="space-y-3">
          <p>로그인이 필요합니다.</p>
          <a href={loginUrl} className="inline-block rounded border px-3 py-1 hover:bg-gray-50">
            로그인 하러가기
          </a>
          <button onClick={checkAndProceed} className="ml-2 rounded border px-3 py-1 hover:bg-gray-50">
            다시 확인
          </button>
        </div>
      )}

      {stage === "eligible" && <p>결제창을 열고 있어요… 잠시만요.</p>}
      {stage === "starting" && <p>주문 생성 중…</p>}
      {stage === "paying" && <p>결제창을 여는 중입니다…</p>}
      {stage === "done" && <p>결제 완료 처리 중…</p>}

      {stage === "error" && (
        <div className="space-y-3">
          <p className="text-red-600">{errorMsg}</p>
          <div className="flex gap-2">
            <button onClick={checkAndProceed} className="rounded border px-3 py-1 hover:bg-gray-50">
              다시 확인
            </button>
            <a href={loginUrl} className="rounded border px-3 py-1 hover:bg-gray-50">
              로그인 하러가기
            </a>
            <button onClick={() => router.replace("/dashboard")} className="rounded border px-3 py-1 hover:bg-gray-50">
              대시보드
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 text-xs text-gray-500">stage: {stage}</div>
    </main>
  );
}
