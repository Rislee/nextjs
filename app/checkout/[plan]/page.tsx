// app/checkout/[plan]/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import OrderConfirmationPage from "./OrderConfirmationPage";
import type { PlanId } from "@/lib/plan";
import { PLAN_TO_TITLE } from "@/lib/plan";

type Stage = "loading" | "checking" | "signin" | "already_has" | "order_form" | "error";

export default function CheckoutPlanPage() {
  const params = useParams();
  const router = useRouter();
  
  // URL 파라미터를 PlanId로 변환 - 더 명확하게
  const planId = useMemo(() => {
    const planParam = String(params.plan || '');
    console.log("Raw plan param:", planParam);
    
    // URL 형식 (start-os) -> PlanId 형식 (START_OS)
    const normalized = planParam.toUpperCase().replace(/-/g, '_');
    console.log("Normalized plan:", normalized);
    
    // 유효한 플랜인지 확인
    if (normalized === 'START_OS' || normalized === 'SIGNATURE_OS' || normalized === 'MASTER_OS') {
      return normalized as PlanId;
    }
    
    console.error("Invalid plan ID:", planParam, "->", normalized);
    return null;
  }, [params.plan]);

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
    () => `/auth/sign-in?next=${encodeURIComponent(`/checkout/${params.plan}`)}`,
    [params.plan]
  );

  // 플랜 ID가 유효하지 않으면 에러 표시
  useEffect(() => {
    if (planId === null) {
      setErrorMsg("유효하지 않은 플랜입니다.");
      setStage("error");
    }
  }, [planId]);

  const checkAndProceed = useCallback(async () => {
    // 플랜 ID가 없으면 실행하지 않음
    if (!planId) {
      console.error("No valid planId");
      return;
    }

    try {
      console.log("=== Checkout Debug ===");
      console.log("1. Starting check for plan:", planId);
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

      console.log("2. Session ensure status:", ensure.status);

      if (ensure.status === 401) {
        console.log("3. Not logged in, showing signin");
        setStage("signin");
        return;
      }

      // 사용자 정보 가져오기
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log("4. User:", user?.email, "Error:", userError?.message);
      
      if (user) {
        setUserInfo({
          email: user.email || '',
          name: user.user_metadata?.full_name || user.user_metadata?.name || ''
        });
      }

      // 다중 플랜 체크 - user_plans 테이블
      const { data: userPlans, error: plansError } = await supabase
        .from("user_plans")
        .select("plan_id, status")
        .eq("status", "active");

      console.log("5. User plans:", userPlans, "Error:", plansError?.message);

      if (userPlans && userPlans.length > 0) {
        const hasThisPlan = userPlans.some(p => p.plan_id === planId);
        
        if (hasThisPlan) {
          console.log("6. Already has this plan:", planId);
          setCurrentPlan(planId);
          setStage("already_has");
          return;
        }
      }

      // 레거시 memberships 테이블도 체크
      const { data: membership } = await supabase
        .from("memberships")
        .select("plan_id, status")
        .maybeSingle();

      console.log("5.5. Legacy membership:", membership);

      if (membership?.status === "active" && membership?.plan_id === planId) {
        console.log("6. Already has plan (legacy)");
        setCurrentPlan(planId);
        setStage("already_has");
        return;
      }

      // 주문서 페이지로
      console.log("7. Showing order form for plan:", planId);
      setStage("order_form");
      
    } catch (e: any) {
      console.error("Error in checkAndProceed:", e);
      setErrorMsg(e?.message || "초기 확인 중 오류가 발생했습니다.");
      setStage("error");
    }
  }, [planId, supabase]);

  useEffect(() => {
    if (planId) {
      console.log("=== Component mounted with valid planId:", planId);
      checkAndProceed();
    }
  }, [planId, checkAndProceed]);

  // 주문서 페이지 렌더링
  if (stage === "order_form" && planId) {
    console.log("=== Rendering OrderConfirmationPage with:", {
      planId,
      userEmail: userInfo.email,
      userName: userInfo.name
    });
    
    return (
      <OrderConfirmationPage 
        planId={planId}
        userEmail={userInfo.email}
        userName={userInfo.name}
      />
    );
  }

  // 플랜이 유효하지 않은 경우
  if (!planId) {
    return (
      <main className="mx-auto max-w-md p-6 text-sm">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-red-600">유효하지 않은 플랜</h2>
          <p className="text-gray-600 mt-2">
            요청하신 플랜을 찾을 수 없습니다.
          </p>
          <button 
            onClick={() => router.push("/dashboard")} 
            className="inneros-button mt-4"
            style={{ width: '100%' }}
          >
            대시보드로 이동
          </button>
        </div>
      </main>
    );
  }

  // 기타 상태들
  return (
    <main className="mx-auto max-w-md p-6 text-sm">
      {stage === "loading" && (
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2">초기화 중...</p>
        </div>
      )}
      
      {stage === "checking" && (
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2">사용자 확인 중...</p>
        </div>
      )}

      {stage === "signin" && (
        <div className="space-y-3">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">로그인이 필요합니다</h2>
            <p className="text-gray-600 mb-4">
              {planId && PLAN_TO_TITLE[planId]} 구매를 위해 로그인해주세요.
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
        </div>
      )}

      {stage === "already_has" && planId && (
        <div className="space-y-3 text-center">
          <h2 className="text-lg font-semibold text-green-600">이미 보유중인 플랜입니다</h2>
          <p className="text-gray-600">
            현재 {PLAN_TO_TITLE[planId]} 플랜을 이용중입니다.
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
              href={`/chat/${params.plan}`}
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
        <div>Plan: {planId && PLAN_TO_TITLE[planId]}</div>
        <div>Plan ID: {planId}</div>
        <div>URL Param: {params.plan}</div>
      </div>
    </main>
  );
}