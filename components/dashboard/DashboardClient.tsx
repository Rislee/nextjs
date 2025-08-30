'use client';

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { PlanId } from "@/lib/plan";
import { PLAN_TO_TITLE, PLAN_LEVEL } from "@/lib/plan";

type Payment = {
  id: string;
  plan_id: PlanId;
  status: string;
  amount: number | null;
  currency: string | null;
  created_at: string;
};

type Membership = {
  plan_id: PlanId | null;
  status: "active" | "past_due" | "canceled" | "none" | null;
  updated_at: string | null;
};

const ALL_PLANS: PlanId[] = ["START_OS", "SIGNATURE_OS", "MASTER_OS"];

export default function DashboardClient() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [payments, setPayments] = useState<Payment[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loadingPay, setLoadingPay] = useState(true);
  const [loadingMem, setLoadingMem] = useState(true);

  useEffect(() => {
    // 결제 내역
    (async () => {
      setLoadingPay(true);
      const { data, error } = await supabase
        .from("payments")
        .select("id, plan_id, status, amount, currency, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!error && data) setPayments(data as any);
      setLoadingPay(false);
    })();

    // 멤버십 1행
    (async () => {
      setLoadingMem(true);
      const { data, error } = await supabase
        .from("memberships")
        .select("plan_id,status,updated_at")
        .maybeSingle();
      if (!error) {
        setMembership((data as any) ?? { plan_id: null, status: null, updated_at: null });
      }
      setLoadingMem(false);
    })();
  }, [supabase]);

  const memActive = membership?.status === "active" && !!membership?.plan_id;

  const upgradeCandidates: PlanId[] = useMemo(() => {
    if (!memActive) return [];
    const cur = membership!.plan_id as PlanId;
    const curLvl = PLAN_LEVEL[cur];
    return ALL_PLANS.filter((p) => PLAN_LEVEL[p] > curLvl);
  }, [memActive, membership]);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      {/* 헤더 (로그아웃 버튼 제거) */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">내 계정</h1>
        {/* 레이아웃 헤더에 AuthStatusButton 사용 중 */}
      </div>

      {/* 활성 OS(멤버십) */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">활성 OS(멤버십)</h2>

        {loadingMem ? (
          <p className="text-sm text-gray-500">멤버십 정보를 불러오는 중…</p>
        ) : memActive ? (
          <div className="rounded border p-4 text-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {PLAN_TO_TITLE[membership!.plan_id as PlanId]}
                </div>
                <div className="text-xs text-gray-500">
                  상태: <span className="text-green-700">active</span>
                  {membership?.updated_at
                    ? ` • 업데이트: ${new Date(membership.updated_at).toLocaleString()}`
                    : ""}
                </div>
              </div>
              <a
                className="rounded-md border px-3 py-1 hover:bg-gray-50"
                href={`/go/${membership!.plan_id}`}
              >
                이용하기
              </a>
            </div>

            {/* 업그레이드 버튼들 */}
            {upgradeCandidates.length > 0 && (
              <div className="pt-2 border-t">
                <div className="mb-2 text-xs text-gray-600">업그레이드</div>
                <div className="flex flex-wrap gap-2">
                  {upgradeCandidates.map((p) => (
                    <a
                      key={p}
                      className="rounded-md border px-3 py-1 hover:bg-gray-50"
                      href={`/checkout/${p}`}
                    >
                      {PLAN_TO_TITLE[p]}로 업그레이드
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded border p-4 text-sm">
            <div className="mb-2">활성 멤버십이 없습니다.</div>
            {membership?.status && membership.status !== "active" ? (
              <div className="text-xs text-gray-500 mb-3">
                현재 상태: {membership.status}
                {membership?.updated_at
                  ? ` • 업데이트: ${new Date(membership.updated_at).toLocaleString()}`
                  : ""}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <a className="rounded-md border px-3 py-1 hover:bg-gray-50" href="/checkout/START_OS">
                START OS 구매
              </a>
              <a className="rounded-md border px-3 py-1 hover:bg-gray-50" href="/checkout/SIGNATURE_OS">
                SIGNATURE OS 구매
              </a>
              <a className="rounded-md border px-3 py-1 hover:bg-gray-50" href="/checkout/MASTER_OS">
                MASTER OS 구매
              </a>
            </div>
          </div>
        )}
      </section>

      {/* 결제 내역 */}
      <section>
        <h2 className="text-lg font-semibold">결제 내역</h2>
        {loadingPay ? (
          <p className="text-sm text-gray-500">불러오는 중…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-gray-500">결제 내역이 없습니다.</p>
        ) : (
          <ul className="divide-y rounded border mt-2">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="font-medium">{PLAN_TO_TITLE[p.plan_id]}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(p.created_at).toLocaleString()} • {p.status}
                    {typeof p.amount === "number"
                      ? ` • ${p.amount.toLocaleString()} ${p.currency || "KRW"}`
                      : ""}
                  </div>
                </div>
                <a
                  className="rounded-md border px-3 py-1 hover:bg-gray-50"
                  href={`/go/${p.plan_id}`}
                >
                  이용하기
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
