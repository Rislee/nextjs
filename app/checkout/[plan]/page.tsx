// app/checkout/[plan]/page.tsx - 주문서 페이지로 수정
'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import OrderConfirmationPage from "./OrderConfirmationPage";
import type { PlanId } from "@/lib/plan";
import { PLAN_TO_TITLE } from "@/lib/plan";

type Stage = "loading" | "checking" | "signin" | "already_has" | "order_form" | "error";

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
  const [currentPlan, setCurrentPlan] = useState<PlanId | null>(null);
  const [userInfo, setUserInfo] = useState<{ email: string; name: string }>({
    email: '',
    name: ''
  });

  const loginUrl = useMemo(
    () => `/auth/sign-in?next=${encodeURIComponent(`/checkout/${plan}`)}`,
    [plan]
  );

  const checkAndProceed = useCallback(async () => {
    try {
      setStage("checking");
      setErrorMsg("");

      // 세션 확인
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

      // 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserInfo({
          email: user.email || '',
          name: user.user_metadata?.full_name || user.user_metadata?.name || ''
        });
      }

      // 활성 멤버십 확인
      const { data: membership } = await supabase
        .from("memberships")
        .select("plan_id,status")
        .maybeSingle();

      if (membership?.status === "active" && membership?.plan_id) {
        setCurrentPlan(membership.plan_id as PlanId);
        
        // 동일한 플랜을 이미 보유중이면 차단
        if (membership.plan_id === plan) {
          setStage("already_has");
          return;
        }
      }

      // 다른 플랜이거나 멤버십이 없으면 주문서 페이지로
      setStage("order_form");
    } catch (e: any) {
      setErrorMsg(e?.message || "초기 확인 중 오류가 발생했습니다.");
      setStage("error");
    }
  }, [plan, supabase]);

  useEffect(() => {
    checkAndProceed();
  }, [checkAndProceed]);

  // 주문서 페이지 렌더링
  if (stage === "order_form") {
    return (
      <OrderConfirmationPage 
        planId={plan}
        userEmail={userInfo.email}
        userName={userInfo.name}
      />
    );
  }

  // 기타 상태들
  return (
    <main className="mx-auto max-w-md p-6 text-sm">
      {stage === "loading" && <p>초기화 중...</p>}
      {stage === "checking" && <p>사용자 확인 중...</p>}

      {stage === "signin" && (
        <div className="space-y-3">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">로그인이 필요합니다</h2>
            <p className="text-gray-600 mb-4">
              {PLAN_TO_TITLE[plan]} 구매를 위해 로그인해주세요.
            </p>
          </div>
          <a 
            href={loginUrl} 
            className="inneros-button"
            style={{ 
              width: '100%', 
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            로그인하기
          </a>
          <button 
            onClick={checkAndProceed} 
            className="inneros-button-secondary"
            style={{ width: '100%' }}
          >
            다시 확인
          </button>
        </div>
      )}

      {stage === "already_has" && (
        <div className="space-y-3 text-center">
          <h2 className="text-lg font-semibold text-green-600">이미 보유중인 플랜입니다</h2>
          <p className="text-gray-600">
            현재 {PLAN_TO_TITLE[plan]} 플랜을 이용중입니다.
          </p>
          <div className="space-y-2">
            <button 
              onClick={() => router.push("/dashboard")} 
              className="inneros-button"
              style={{ width: '100%' }}
            >
              대시보드로 이동
            </button>
            <a 
              href={`/chat/${plan.toLowerCase().replace('_', '-')}`}
              className="inneros-button-secondary"
              style={{ 
                width: '100%', 
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              플랜 이용하기
            </a>
          </div>
        </div>
      )}

      {stage === "error" && (
        <div className="space-y-3">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-600">오류 발생</h2>
            <p className="text-red-600 mt-2">{errorMsg}</p>
          </div>
          <div className="space-y-2">
            <button 
              onClick={checkAndProceed} 
              className="inneros-button"
              style={{ width: '100%' }}
            >
              다시 시도
            </button>
            <button 
              onClick={() => router.push("/dashboard")} 
              className="inneros-button-secondary"
              style={{ width: '100%' }}
            >
              대시보드로 이동
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 text-xs text-gray-500 text-center">
        <div>Stage: {stage}</div>
        <div>Plan: {PLAN_TO_TITLE[plan]}</div>
        <div>Current Plan: {currentPlan ? PLAN_TO_TITLE[currentPlan] : 'none'}</div>
      </div>
    </main>
  );
}