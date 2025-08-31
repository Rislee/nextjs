// app/chat/[plan]/page.tsx
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PLAN_TO_TITLE, type PlanId } from "@/lib/plan";
import ChatInterface from "./ChatInterface";

export const dynamic = "force-dynamic";

async function getCurrentUser() {
  const ck = await cookies();
  const uid = ck.get("uid")?.value;
  
  if (!uid) return null;

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
  return data.user;
}

async function getUserPlans(userId: string) {
  const { data: userPlans } = await supabaseAdmin
    .from("user_plans")
    .select("plan_id, status")
    .eq("user_id", userId)
    .eq("status", "active");

  return userPlans || [];
}

export default async function ChatPlanPage({
  params,
}: {
  params: { plan: string };
}) {
  const planId = params.plan.toUpperCase() as PlanId;
  
  // 유효한 플랜인지 확인
  if (!["START_OS", "SIGNATURE_OS", "MASTER_OS"].includes(planId)) {
    redirect("/dashboard");
  }

  // 1. 사용자 인증 확인
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/sign-in?next=/chat/${params.plan}`);
  }

  // 2. 사용자 플랜 권한 확인
  const userPlans = await getUserPlans(user.id);
  const hasAccess = userPlans.some(p => p.plan_id === planId);

  if (!hasAccess) {
    redirect(`/checkout/${planId}`);
  }

  // 3. 기존 Thread 조회
  const { data: existingThread } = await supabaseAdmin
    .from('user_threads')
    .select('thread_id')
    .eq('user_id', user.id)
    .eq('plan_id', planId)
    .maybeSingle();

  return (
    <div className="h-screen flex flex-col">
      <ChatInterface
        userId={user.id}
        planId={planId}
        planTitle={PLAN_TO_TITLE[planId]}
        userEmail={user.email || ""}
        existingThreadId={existingThread?.thread_id || null}
      />
    </div>
  );
}