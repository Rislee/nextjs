// app/checkout/[plan]/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import Script from "next/script";
import { requestIamportPay } from "@/lib/portone/v1-client";
import type { PlanId } from "@/lib/plan";
import { hasAccessOrHigher, PLAN_TO_TITLE } from "@/lib/plan";

type Stage = "loading" | "checking" | "signin" | "already_has" | "eligible" | "starting" | "paying" | "done" | "error";

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

  const [stage, setStage] = useState<Stage>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sdkReady, setSdkReady] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<PlanId | null>(null);

  const loginUrl = useMemo(
    () => `/auth/sign-in?next=${encodeURIComponent(`/checkout/${plan}`)}`,
    [plan]
  );

  // SDK 로드 체크
  useEffect(() => {
    const checkSDK = setInterval(() => {
      if (typeof window !== 'undefined' && window.IMP) {
        setSdkReady(true);
        clearInterval(checkSDK);
      }
    }, 100);

    // 3초 후에도 로드 안되면 정리
    const timeout = setTimeout(() => {
      clearInterval(checkSDK);
    }, 3000);

    return () => {
      clearInterval(checkSDK);
      clearTimeout(timeout);
    };
  }, []);

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
        setStage("signin");
        return;
      }

      // 활성 멤버십 확인
      const { data: membership } = await supabase
        .from("memberships")
        .select("plan_id,status")
        .maybeSingle();

      if (membership?.status === "active" && membership?.plan_id) {
        setCurrentPlan(membership.plan_id as PlanId);
        
        // 동일하거나 상위 플랜을 이미 보유중
        if (hasAccessOrHigher(membership.plan_id as PlanId, plan)) {
          setStage("already_has");
          return;
        }
      }

      setStage("eligible");
    } catch (e: any) {
      setErrorMsg(e?.message || "초기 확인 중 오류가 발생했습니다.");
      setStage("error");
    }
  }, [plan, supabase]);

  useEffect(() => {
    if (sdkReady) {
      checkAndProceed();
    }
  }, [sdkReady, checkAndProceed]);

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
        // 이미 보유중인 플랜
        setStage("already_has");
        return;
      }

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`주문 생성 실패 (${res.status}) ${txt}`);
      }

      const { merchantUid, amount, orderName } = await res.json();

      // m_redirect_url 로 사용할 절대 URL
      const redirectUrl =
        process.env.NEXT_PUBLIC_PORTONE_REDIRECT_URL ||
        `${window.location.origin}/checkout/complete`;

      setStage("paying");
      await requestIamportPay({
        merchant_uid: merchantUid,
        amount,
        name: orderName,
        redirectUrl,
      });

      setStage("done");
    } catch (e: any) {
      setErrorMsg(e?.message || "결제창 호출에 실패했습니다.");
      setStage("error");
    }
  }, [plan]);

  // eligible 상태가 되면 자동으로 결제 시작
  useEffect(() => {
    if (stage !== "eligible") return;
    const t = setTimeout(() => { 
      startOrderAndPay(); 
    }, 300);
    return () => clearTimeout(t);
  }, [stage, startOrderAndPay]);

  // SDK 로딩 전
  if (!sdkReady) {
    return (
      <>
        <Script 
          src="https://cdn.iamport.kr/v1/iamport.js" 
          onLoad={() => setSdkReady(true)}
        />
        <main className="mx-auto max-w-md p-6 text-sm">
          <p>결제 시스템을 초기화하는 중...</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Script src="https://cdn.iamport.kr/v1/iamport.js" />
      <main className="mx-auto max-w-md p-6 text-sm">
        {stage === "loading" && <p>초기화 중...</p>}
        {stage === "checking" && <p>사용자 확인 중...</p>}

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

        {stage === "already_has" && (
          <div className="space-y-3">
            <h2 className="font-semibold">이미 보유중인 플랜입니다</h2>
            {currentPlan && (
              <p className="text-gray-600">
                현재 플랜: {PLAN_TO_TITLE[currentPlan]}
              </p>
            )}
            <p className="text-sm text-gray-500">
              {plan === currentPlan 
                ? "동일한 플랜을 이미 이용중입니다."
                : "더 높은 등급의 플랜을 이미 이용중입니다."}
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => router.push("/dashboard")} 
                className="rounded border px-3 py-1 hover:bg-gray-50"
              >
                대시보드로 이동
              </button>
              {currentPlan && (
                <a 
                  href={`/go/${currentPlan}`}
                  className="rounded border px-3 py-1 hover:bg-gray-50"
                >
                  현재 플랜 이용하기
                </a>
              )}
            </div>
          </div>
        )}

        {stage === "eligible" && <p>결제창을 열고 있어요... 잠시만요.</p>}
        {stage === "starting" && <p>주문 생성 중...</p>}
        {stage === "paying" && <p>결제창을 여는 중입니다...</p>}
        {stage === "done" && <p>결제 완료 처리 중...</p>}

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
              <button onClick={() => router.push("/dashboard")} className="rounded border px-3 py-1 hover:bg-gray-50">
                대시보드
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 text-xs text-gray-500">
          <div>stage: {stage}</div>
          <div>plan: {plan}</div>
          <div>SDK: {sdkReady ? "Ready" : "Loading..."}</div>
        </div>
      </main>
    </>
  );
}