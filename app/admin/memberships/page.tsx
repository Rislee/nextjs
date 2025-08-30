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

// ---- Server Actions ----
export async function grantAction(formData: FormData) {
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

  const { error } = await admin.rpc("admin_grant_membership", {
    p_email: target,
    p_plan: plan,
    p_status: "active",
  });
  if (error) throw new Error(error.message);

  redirect(`/admin/memberships?q=${encodeURIComponent(target)}`);
}

export async function revokeAction(formData: FormData) {
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

// ---- Page ----
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
  let record:
    | { user_id: string; email: string; plan_id: string | null; status: string | null; updated_at: string | null }
    | null = null;

  if (q) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data, error } = await admin.rpc("admin_get_membership_by_email", {
      p_email: q,
    });
    if (!error && data && data.length > 0) {
      record = data[0] as any;
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">멤버십 관리</h1>
        <a href="/dashboard" className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
          대시보드로 돌아가기
        </a>
      </div>
      
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
        <p className="text-sm text-amber-800">
          🔐 관리자 전용 페이지 • {email}
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
      ) : record ? (
        <div className="rounded border p-4 text-sm space-y-2">
          <div>
            <span className="text-gray-500">이메일</span> {record.email}
          </div>
          <div>
            <span className="text-gray-500">user_id</span> {record.user_id}
          </div>
          <div>
            <span className="text-gray-500">현재 플랜</span>{" "}
            {record.plan_id || "(없음)"} / {record.status || "(없음)"}
          </div>
          <div className="text-xs text-gray-500">
            업데이트: {record.updated_at || "-"}
          </div>

          {/* 활성화 */}
          <div className="pt-3 flex flex-wrap gap-2">
            {["START_OS", "SIGNATURE_OS", "MASTER_OS"].map((p) => (
              <form key={p} action={grantAction}>
                <input type="hidden" name="target_email" value={q} />
                <input type="hidden" name="plan" value={p} />
                <button className="rounded border px-3 py-1 hover:bg-gray-50">
                  {p} 활성화
                </button>
              </form>
            ))}

            {/* 회수 */}
            <form action={revokeAction}>
              <input type="hidden" name="target_email" value={q} />
              <input type="hidden" name="status" value="canceled" />
              <button className="rounded border px-3 py-1 hover:bg-gray-50">
                권한 회수
              </button>
            </form>
          </div>
        </div>
      ) : (
        <p className="text-sm text-red-600">해당 이메일의 사용자가 없거나 멤버십이 없습니다.</p>
      )}
    </main>
  );
}