'use client';

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import ProfileForm from "../../app/dashboard/ProfileForm";
import type { PlanId } from "@/lib/plan";
import { PLAN_TO_TITLE } from "@/lib/plan";
import LogoutButton from "@/components/auth/LogoutButton";


type Payment = {
  id: string;
  plan_id: PlanId;
  status: string;
  amount: number | null;
  currency: string | null;
  created_at: string;
};

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // 내 결제내역 (RLS로 user_id=auth.uid()만 조회)
      const { data, error } = await supabase
        .from("payments")
        .select("id, plan_id, status, amount, currency, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!error && data) setPayments(data as any);
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <section>
        <h1 className="text-xl font-semibold">내 정보</h1>
        <ProfileForm />
      </section>

      <section>
        <h2 className="text-lg font-semibold mt-4">구매 내역</h2>
        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-gray-500">구매 내역이 없습니다.</p>
        ) : (
          <ul className="divide-y rounded border mt-2">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold">내 정보</h1>
                    <LogoutButton />
                  </div>
                  <div className="font-medium">{PLAN_TO_TITLE[p.plan_id]}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(p.created_at).toLocaleString()} • {p.status}
                    {p.amount ? ` • ${p.amount.toLocaleString()} ${p.currency || "KRW"}` : ""}
                  </div>
                </div>
                <a
                  className="rounded-md border px-3 py-1 hover:bg-gray-50"
                  href={`/go/${p.plan_id}`}
                  target="_self"
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
