'use client';

import { useEffect, useState } from "react";
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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let gone = false;
    (async () => {
      setLoading(true);
      const res = await fetch("/api/me/summary", { credentials: "include" });
      if (gone) return;

      if (res.status === 401) {
        window.location.assign("/auth/sign-in?next=/dashboard");
        return;
      }
      if (!res.ok) {
        console.error("summary fetch failed", await res.text());
        setLoading(false);
        return;
      }
      const json = await res.json();
      setMembership(json.membership ?? { plan_id: null, status: null, updated_at: null });
      setPayments(json.payments ?? []);
      setLoading(false);
    })();
    return () => { gone = true; };
  }, []);

  const memActive = membership?.status === "active" && !!membership?.plan_id;

  const upgradeCandidates: PlanId[] = (() => {
    if (!memActive) return [];
    const cur = membership!.plan_id as PlanId;
    const curLvl = PLAN_LEVEL[cur];
    return ALL_PLANS.filter((p) => PLAN_LEVEL[p] > curLvl);
  })();

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">내 계정</h1>
        {/* 레이아웃에 AuthStatusButton 사용 중 */}
      </div>

      {/* 활성 OS(멤버십) */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">활성 OS(멤버십)</h2>
        {loading ? (
          <p className="text-sm text-gray-500">멤버십 정보를 불러오는 중…</p>
        ) : memActive ? (
          <div className="rounded border p-4 text-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{PLAN_TO_TITLE[membership!.plan_id as PlanId]}</div>
                <div className="text-xs text-gray-500">
                  상태: <span className="text-green-700">active</span>
                  {membership?.updated_at ? ` • 업데이트: ${new Date(membership.updated_at).toLocaleString()}` : ""}
                </div>
              </div>
              <a className="rounded-md border px-3 py-1 hover:bg-gray-50" href={`/go/${membership!.plan_id}`}>
                이용하기
              </a>
            </div>

            {upgradeCandidates.length > 0 && (
              <div className="pt-2 border-t">
                <div className="mb-2 text-xs text-gray-600">업그레이드</div>
                <div className="flex flex-wrap gap-2">
                  {upgradeCandidates.map((p) => (
                    <a key={p} className="rounded-md border px-3 py-1 hover:bg-gray-50" href={`/checkout/${p}`}>
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
                {membership?.updated_at ? ` • 업데이트: ${new Date(membership.updated_at).toLocaleString()}` : ""}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <a className="rounded-md border px-3 py-1 hover:bg-gray-50" href="/checkout/START_OS">START OS 구매</a>
              <a className="rounded-md border px-3 py-1 hover:bg-gray-50" href="/checkout/SIGNATURE_OS">SIGNATURE OS 구매</a>
              <a className="rounded-md border px-3 py-1 hover:bg-gray-50" href="/checkout/MASTER_OS">MASTER OS 구매</a>
            </div>
          </div>
        )}
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
              <li key={p.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="font-medium">{PLAN_TO_TITLE[p.plan_id]}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(p.created_at).toLocaleString()} • {p.status}
                    {typeof p.amount === "number" ? ` • ${p.amount.toLocaleString()} ${p.currency || "KRW"}` : ""}
                  </div>
                </div>
                <a className="rounded-md border px-3 py-1 hover:bg-gray-50" href={`/go/${p.plan_id}`}>
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
