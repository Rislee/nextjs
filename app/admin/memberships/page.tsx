// app/admin/memberships/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admin";

async function getCurrentUserEmail() {
  const ck = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => ck.get(name)?.value,
        set() {},
        remove() {},
      },
    }
  );
  const { data } = await supabase.auth.getUser();
  return data.user?.email || null;
}

// 특정 플랜 권한 부여
export async function grantPlanAction(formData: FormData) {
  "use server";
  const email = await getCurrentUserEmail();
  if (!isAdminEmail(email)) throw new Error("forbidden");

  const target = String(formData.get("target_email") || "");
  const plan = String(formData.get("plan") || "");
  if (!target || !plan) throw new Error("missing params");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { error } = await admin.rpc("admin_grant_plan", {
    p_email: target,
    p_plan: plan,
    p_status: "active",
  });
  if (error) throw new Error(error.message);

  redirect(`/admin/memberships?q=${encodeURIComponent(target)}`);
}

// 특정 플랜 권한 회수
export async function revokePlanAction(formData: FormData) {
  "use server";
  const email = await getCurrentUserEmail();
  if (!isAdminEmail(email)) throw new Error("forbidden");

  const target = String(formData.get("target_email") || "");
  const plan = String(formData.get("plan") || "");
  const status = String(formData.get("status") || "canceled");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { error } = await admin.rpc("admin_revoke_plan", {
    p_email: target,
    p_plan: plan,
    p_status: status,
  });
  if (error) throw new Error(error.message);

  redirect(`/admin/memberships?q=${encodeURIComponent(target)}`);
}

// 모든 플랜 권한 회수
export async function revokeAllPlansAction(formData: FormData) {
  "use server";
  const email = await getCurrentUserEmail();
  if (!isAdminEmail(email)) throw new Error("forbidden");

  const target = String(formData.get("target_email") || "");
  const status = String(formData.get("status") || "canceled");

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { error } = await admin.rpc("admin_revoke_membership", {
    p_email: target,
    p_status: status,
  });
  if (error) throw new Error(error.message);

  redirect(`/admin/memberships?q=${encodeURIComponent(target)}`);
}

export default async function Page({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const email = await getCurrentUserEmail();
  if (!email) redirect("/auth/sign-in?next=/admin/memberships");
  if (!isAdminEmail(email))
    return (
      <main className="p-6">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-lg font-semibold text-red-600">접근 권한 없음</h1>
          <p className="text-sm text-gray-600 mt-2">
            관리자 권한이 필요합니다.
          </p>
          <a href="/dashboard" className="inline-block mt-4 rounded border px-3 py-1 text-sm hover:bg-gray-50">
            대시보드로 돌아가기
          </a>
        </div>
      </main>
    );

  const q = (searchParams?.q || "").trim();
  let userPlans: any[] = [];

  if (q) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    
    const { data, error } = await admin.rpc("admin_get_user_plans", {
      p_email: q,
    });
    
    if (!error && data) {
      userPlans = data as any[];
    }
  }

  const allPlans = ["START_OS", "SIGNATURE_OS", "MASTER_OS"];
  const planTitles = {
    START_OS: "START OS",
    SIGNATURE_OS: "SIGNATURE OS", 
    MASTER_OS: "MASTER OS"
  };

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">멤버십 관리 (다중 플랜)</h1>
        <a href="/dashboard" className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
          대시보드로 돌아가기
        </a>
      </div>
      
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
        <p className="text-sm text-amber-800">
          관리자 전용 페이지 • {email}
        </p>
        <p className="text-xs text-amber-700 mt-1">
          이제 사용자는 여러 플랜을 동시에 보유할 수 있습니다.
        </p>
      </div>

      {/* 검색 */}
      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="user@example.com"
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          검색
        </button>
      </form>

      {/* 결과 */}
      {!q ? (
        <p className="text-sm text-gray-500">이메일로 검색하세요.</p>
      ) : userPlans.length === 0 ? (
        <p className="text-sm text-red-600">해당 이메일의 사용자가 없거나 활성 플랜이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          {/* 사용자 정보 */}
          <div className="rounded border p-4 bg-gray-50">
            <h3 className="font-semibold text-sm mb-2">사용자 정보</h3>
            <div className="text-sm">
              <div>이메일: {userPlans[0]?.email}</div>
              <div>User ID: {userPlans[0]?.user_id}</div>
            </div>
          </div>

          {/* 보유 중인 플랜들 */}
          <div className="rounded border p-4">
            <h3 className="font-semibold text-sm mb-3">보유 중인 플랜 ({userPlans.filter(p => p.plan_id).length}개)</h3>
            
            {userPlans.filter(p => p.plan_id).length === 0 ? (
              <p className="text-sm text-gray-600">활성 플랜 없음</p>
            ) : (
              <div className="space-y-2">
                {userPlans
                  .filter(p => p.plan_id)
                  .map((plan, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded border-l-4 border-green-400">
                    <div>
                      <div className="font-medium text-sm">
                        {planTitles[plan.plan_id as keyof typeof planTitles]} ({plan.plan_id})
                      </div>
                      <div className="text-xs text-gray-600">
                        상태: {plan.status} • 
                        활성화: {new Date(plan.activated_at).toLocaleString()}
                        {plan.expires_at && ` • 만료: ${new Date(plan.expires_at).toLocaleString()}`}
                      </div>
                    </div>
                    <form action={revokePlanAction} className="inline">
                      <input type="hidden" name="target_email" value={q} />
                      <input type="hidden" name="plan" value={plan.plan_id} />
                      <input type="hidden" name="status" value="canceled" />
                      <button className="text-xs rounded border px-2 py-1 hover:bg-gray-50 text-red-600">
                        회수
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 플랜 관리 액션 */}
          <div className="rounded border p-4">
            <h3 className="font-semibold text-sm mb-3">플랜 관리</h3>
            
            {/* 개별 플랜 부여 */}
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-gray-700">개별 플랜 부여</h4>
              <div className="flex flex-wrap gap-2">
                {allPlans.map((planId) => {
                  const hasThisPlan = userPlans.some(p => p.plan_id === planId);
                  return (
                    <form key={planId} action={grantPlanAction} className="inline">
                      <input type="hidden" name="target_email" value={q} />
                      <input type="hidden" name="plan" value={planId} />
                      <button 
                        className={`text-xs rounded border px-3 py-1 hover:bg-gray-50 ${
                          hasThisPlan ? 'bg-green-100 text-green-800' : ''
                        }`}
                        disabled={hasThisPlan}
                      >
                        {planTitles[planId as keyof typeof planTitles]} {hasThisPlan ? '(보유중)' : '부여'}
                      </button>
                    </form>
                  );
                })}
              </div>
              
              {/* 모든 플랜 회수 */}
              <div className="pt-3 border-t">
                <h4 className="text-xs font-medium text-gray-700 mb-2">전체 관리</h4>
                <form action={revokeAllPlansAction} className="inline">
                  <input type="hidden" name="target_email" value={q} />
                  <input type="hidden" name="status" value="canceled" />
                  <button className="text-xs rounded border px-3 py-1 hover:bg-gray-50 text-red-600">
                    모든 플랜 회수
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}