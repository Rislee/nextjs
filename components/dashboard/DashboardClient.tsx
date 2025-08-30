'use client';

import { useEffect, useState } from "react";
import type { PlanId } from "@/lib/plan";
import { PLAN_TO_TITLE, ALL_PLANS } from "@/lib/plan";

type Payment = {
  id: string;
  plan_id: PlanId;
  status: string;
  amount: number | null;
  currency: string | null;
  created_at: string;
};

type ActivePlan = {
  plan_id: PlanId;
  status: "active";
  activated_at: string;
  expires_at: string | null;
  updated_at: string;
};

interface DashboardClientProps {
  isAdmin?: boolean;
  userEmail?: string;
}

export default function DashboardClient({ isAdmin = false, userEmail = "" }: DashboardClientProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activePlans, setActivePlans] = useState<ActivePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let gone = false;
    (async () => {
      setLoading(true);
      setError("");
      
      try {
        const res = await fetch("/api/me/summary", { 
          credentials: "include",
          cache: "no-store"
        });
        
        if (gone) return;

        if (res.status === 401) {
          console.log("Unauthorized, redirecting to login...");
          window.location.assign("/auth/sign-in?next=/dashboard");
          return;
        }
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("summary fetch failed:", res.status, errorText);
          setError(`데이터를 불러올 수 없습니다. (${res.status})`);
          setLoading(false);
          return;
        }
        
        const json = await res.json();
        setActivePlans(json.activePlans ?? []);
        setPayments(json.payments ?? []);
        setLoading(false);
        
      } catch (err: any) {
        if (gone) return;
        console.error("Dashboard fetch error:", err);
        setError(err?.message || "네트워크 오류가 발생했습니다.");
        setLoading(false);
      }
    })();
    
    return () => { gone = true; };
  }, []);

  // 보유 중인 플랜 ID 목록
  const ownedPlanIds = activePlans.map(plan => plan.plan_id);
  
  // 구매 가능한 플랜들 (보유하지 않은 플랜들)
  const purchasablePlans = ALL_PLANS.filter(planId => !ownedPlanIds.includes(planId));

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 text-sm text-red-600 underline"
          >
            다시 시도
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">내 계정</h1>
          {userEmail && (
            <p className="text-sm text-gray-500 mt-1">{userEmail}</p>
          )}
        </div>
        {isAdmin && (
          <a
            href="/admin/memberships"
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 text-white px-4 py-2 text-sm hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            관리자 페이지
          </a>
        )}
      </div>

      {/* 보유 중인 활성 플랜들 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">보유 중인 플랜</h2>
        {loading ? (
          <p className="text-sm text-gray-500">플랜 정보를 불러오는 중…</p>
        ) : activePlans.length > 0 ? (
          <div className="space-y-3">
            {activePlans.map((plan, index) => (
              <div key={plan.plan_id} className="rounded border p-4 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {PLAN_TO_TITLE[plan.plan_id]}
                    </div>
                    <div className="text-xs text-gray-500">
                      상태: <span className="text-green-700">active</span>
                      {' • '}
                      활성화: {new Date(plan.activated_at).toLocaleString()}
                      {plan.expires_at && (
                        <>
                          {' • '}
                          만료: {new Date(plan.expires_at).toLocaleString()}
                        </>
                      )}
                    </div>
                  </div>
                  <a
                    className="rounded-md border px-3 py-1 hover:bg-gray-50"
                    href={`/go/${plan.plan_id}`}
                  >
                    이용하기
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded border p-4 text-sm">
            <p className="text-gray-600">현재 보유 중인 활성 플랜이 없습니다.</p>
          </div>
        )}
      </section>

      {/* 추가 구매 가능한 플랜들 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          {activePlans.length > 0 ? "추가 구매 가능한 플랜" : "구매 가능한 플랜"}
        </h2>
        <div className="rounded border p-4 text-sm">
          {purchasablePlans.length > 0 ? (
            <>
              <div className="mb-3">
                {activePlans.length > 0 
                  ? "추가로 다른 플랜을 구매할 수 있습니다. 여러 플랜을 동시에 보유할 수 있습니다."
                  : "원하는 플랜을 선택해주세요."
                }
              </div>
              <div className="flex flex-wrap gap-2">
                {purchasablePlans.map((planId) => (
                  <a
                    key={planId}
                    className="rounded-md border px-3 py-1 hover:bg-gray-50"
                    href={`/checkout/${planId}`}
                  >
                    {PLAN_TO_TITLE[planId]} 구매
                  </a>
                ))}
              </div>
            </>
          ) : (
            <div>
              <p className="text-gray-600 mb-2">
                모든 플랜을 보유하고 계십니다.
              </p>
              <p className="text-xs text-gray-500">
                관리자가 수동으로 권한을 부여한 경우에도 여기에서 활성 상태로 표시됩니다.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 결제 내역 */}
      <section>
        <h2 className="text-lg font-semibold">결제 내역</h2>
        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-gray-500">결제 내역이 없습니다.</p>
        ) : (
          <ul className="divide-y rounded border mt-2">
            {payments.map((p) => (
              <li key={p.id} className="p-3 text-sm">
                <div>
                  <div className="font-medium">{PLAN_TO_TITLE[p.plan_id]}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(p.created_at).toLocaleString()} • {p.status}
                    {typeof p.amount === "number"
                      ? ` • ${p.amount.toLocaleString()} ${p.currency || "KRW"}`
                      : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}