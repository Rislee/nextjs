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
  
  // URL 파라미터를 PlanId로 변환
  const planId = useMemo(() => {
    const planParam = String(params.plan || '');
    console.log("=== Plan Conversion Debug ===");
    console.log("Raw URL param:", planParam);
    
    // URL 형식 (start-os) -> PlanId 형식 (START_OS)
    const normalized = planParam.toUpperCase().replace(/-/g, '_');
    console.log("Normalized to:", normalized);
    
    // 유효한 플랜인지 확인
    if (normalized === 'START_OS' || normalized === 'SIGNATURE_OS' || normalized === 'MASTER_OS') {
      return normalized as PlanId;
    }
    
    console.error("Invalid plan ID:", planParam);
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
  const [userInfo, setUserInfo] = useState<{ email: string; name: string }>({
    email: '',
    name: ''
  });

  const loginUrl = useMemo(
    () => `/auth/sign-in?next=${encodeURIComponent(`/checkout/${params.plan}`)}`,
    [params.plan]
  );

  const checkAndProceed = useCallback(async () => {
    // 플랜 ID가 없으면 에러
    if (!planId) {
      console.error("No valid planId to proceed");
      setErrorMsg("유효하지 않은 플랜입니다.");
      setStage("error");
      return;
    }

    try {
      console.log("=== Checkout Flow Debug ===");
      console.log("1. Starting checkout for plan:", planId);
      console.log("2. Current stage:", stage);
      
      setStage("checking");
      setErrorMsg("");

      // 세션 확인 - 타임아웃 증가
      console.log("3. Checking session...");
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), 10000); // 10초로 증가
      
      try {
        const ensure = await fetch("/api/session/ensure", {
          method: "GET",
          credentials: "include",
          signal: ac.signal,
        });
        clearTimeout(tid);
        
        console.log("4. Session API response:", ensure.status);

        if (ensure.status === 401) {
          console.log("5. User not logged in, showing signin");
          setStage("signin");
          return;
        }

        if (!ensure.ok) {
          console.log("5. Session API error, status:", ensure.status);
          const errorData = await ensure.json();
          console.log("5. Error data:", errorData);
          throw new Error("세션 확인 실패");
        }
      } catch (fetchError: any) {
        if (fetchError.name === "AbortError") {
          console.log("5. Session check timeout");
          throw new Error("세션 확인 타임아웃");
        }
        console.log("5. Session check error:", fetchError);
        throw fetchError;
      }

      // 사용자 정보 가져오기
      console.log("6. Getting user info...");
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.log("7. User fetch error:", userError);
        throw userError;
      }

      if (user) {
        console.log("7. User found:", user.email);
        setUserInfo({
          email: user.email || '',
          name: user.user_metadata?.full_name || user.user_metadata?.name || ''
        });
      } else {
        console.log("7. No user found in session");
        setStage("signin");
        return;
      }

      // 다중 플랜 체크 - user_plans 테이블
      console.log("8. Checking user plans...");
      const { data: userPlans, error: plansError } = await supabase
        .from("user_plans")
        .select("plan_id, status")
        .eq("status", "active");

      console.log("9. User plans result:", { 
        data: userPlans, 
        error: plansError?.message 
      });

      if (!plansError && userPlans && userPlans.length > 0) {
        const hasThisPlan = userPlans.some(p => p.plan_id === planId);
        
        if (hasThisPlan) {
          console.log("10. User already has this plan");
          setStage("already_has");
          return;
        }
      }

      // 레거시 memberships 테이블도 체크
      console.log("11. Checking legacy membership...");
      const { data: membership } = await supabase
        .from("memberships")
        .select("plan_id, status")
        .maybeSingle();

      console.log("12. Legacy membership:", membership);

      if (membership?.status === "active" && membership?.plan_id === planId) {
        console.log("13. User has plan in legacy system");
        setStage("already_has");
        return;
      }

      // 주문서 페이지 표시
      console.log("14. All checks passed, showing order form");
      console.log("15. Setting stage to: order_form");
      setStage("order_form");
      
    } catch (e: any) {
      console.error("=== Checkout Error ===");
      console.error("Error:", e);
      setErrorMsg(e?.message || "초기 확인 중 오류가 발생했습니다.");
      setStage("error");
    }
  }, [planId, supabase, stage]); // stage 의존성 제거

  // 초기 로드
  useEffect(() => {
    console.log("=== Component Mounted ===");
    console.log("Plan ID:", planId);
    console.log("Stage:", stage);
    
    if (planId && stage === "loading") {
      console.log("Starting checkout flow...");
      checkAndProceed();
    }
  }, [planId]); // checkAndProceed 의존성 제거

  // 스테이지 변경 로깅
  useEffect(() => {
    console.log("=== Stage Changed to:", stage, "===");
  }, [stage]);

  // 주문서 페이지 렌더링
  if (stage === "order_form" && planId) {
    console.log("=== Rendering Order Form ===");
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
            요청하신 플랜을 찾을 수 없습니다. (URL: {params.plan})
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

  // 로딩 상태
  if (stage === "loading") {
    return (
      <main className="mx-auto max-w-md p-6 text-sm">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2">초기화 중...</p>
          <p className="text-xs text-gray-500 mt-2">Stage: {stage}</p>
        </div>
      </main>
    );
  }

  // 체킹 상태
  if (stage === "checking") {
    return (
      <main className="mx-auto max-w-md p-6 text-sm">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2">사용자 확인 중...</p>
          <p className="text-xs text-gray-500 mt-2">Stage: {stage}</p>
        </div>
      </main>
    );
  }

  // 로그인 필요
  if (stage === "signin") {
    return (
      <main className="mx-auto max-w-md p-6 text-sm">
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
      </main>
    );
  }

  // 이미 보유중
  if (stage === "already_has" && planId) {
    return (
      <main className="mx-auto max-w-md p-6 text-sm">
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
          </div>
        </div>
      </main>
    );
  }

  // 에러 상태
  if (stage === "error") {
    return (
      <main className="mx-auto max-w-md p-6 text-sm">
        <div className="space-y-3">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-600">오류 발생</h2>
            <p className="text-red-600 mt-2">{errorMsg}</p>
          </div>
          <div className="space-y-2">
            <button 
              onClick={() => {
                setStage("loading");
                checkAndProceed();
              }} 
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
      </main>
    );
  }

  // 기본 상태
  return (
    <main className="mx-auto max-w-md p-6 text-sm">
      <div className="text-center">
        <p>처리 중...</p>
        <div className="mt-6 text-xs text-gray-500">
          <div>Stage: {stage}</div>
          <div>Plan: {planId}</div>
        </div>
      </div>
    </main>
  );
}