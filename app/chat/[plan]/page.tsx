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
  
  console.log(`[Chat Page] UID from cookie:`, uid ? uid.substring(0, 8) + '...' : 'none');
  
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

  try {
    const { data, error } = await supabase.auth.getUser();
    console.log(`[Chat Page] Supabase auth result:`, error ? 'ERROR: ' + error.message : 'SUCCESS');
    
    if (error) {
      console.log(`[Chat Page] Auth error:`, error);
      return null;
    }
    
    console.log(`[Chat Page] User found:`, data.user?.email);
    return data.user;
  } catch (e) {
    console.error(`[Chat Page] Auth exception:`, e);
    return null;
  }
}

async function getUserPlans(userId: string) {
  try {
    const { data: userPlans, error } = await supabaseAdmin
      .from("user_plans")
      .select("plan_id, status")
      .eq("user_id", userId)
      .eq("status", "active");

    console.log(`[Chat Page] User plans query result:`, error ? 'ERROR: ' + error.message : 'SUCCESS');
    
    if (error) {
      console.error(`[Chat Page] Plans query error:`, error);
      return [];
    }

    console.log(`[Chat Page] Active plans found:`, userPlans?.map(p => p.plan_id) || []);
    return userPlans || [];
  } catch (e) {
    console.error(`[Chat Page] Plans query exception:`, e);
    return [];
  }
}

export default async function ChatPlanPage({
  params,
}: {
  params: { plan: string };
}) {
  console.log(`[Chat Page] === Starting chat page for plan: ${params.plan} ===`);
  
  // URL 파라미터 변환: start-os -> START_OS
  let planId: PlanId;
  
  if (params.plan === 'start-os') {
    planId = 'START_OS';
  } else if (params.plan === 'signature-os') {
    planId = 'SIGNATURE_OS';  
  } else if (params.plan === 'master-os') {
    planId = 'MASTER_OS';
  } else {
    // 대문자로도 시도
    const upperPlan = params.plan.toUpperCase().replace('-', '_');
    if (["START_OS", "SIGNATURE_OS", "MASTER_OS"].includes(upperPlan)) {
      planId = upperPlan as PlanId;
    } else {
      console.log(`[Chat Page] Invalid plan: ${params.plan}, redirecting to dashboard`);
      redirect("/dashboard");
    }
  }
  
  console.log(`[Chat Page] Converted plan: ${params.plan} -> ${planId}`);

  // 1. 사용자 인증 확인
  const user = await getCurrentUser();
  if (!user) {
    console.log(`[Chat Page] No user found, redirecting to sign-in`);
    redirect(`/auth/sign-in?next=/chat/${params.plan}`);
  }

  console.log(`[Chat Page] User authenticated: ${user.email} (${user.id})`);

  // 2. 사용자 플랜 권한 확인
  const userPlans = await getUserPlans(user.id);
  const hasAccess = userPlans.some(p => p.plan_id === planId);

  console.log(`[Chat Page] Access check: user has ${planId}? ${hasAccess}`);

  if (!hasAccess) {
    console.log(`[Chat Page] No access to ${planId}, redirecting to checkout`);
    redirect(`/checkout/${planId}`);
  }

  // 3. 기존 Thread 조회
  let existingThread = null;
  try {
    const { data: threadData, error: threadError } = await supabaseAdmin
      .from('user_threads')
      .select('thread_id')
      .eq('user_id', user.id)
      .eq('plan_id', planId)
      .maybeSingle();

    console.log(`[Chat Page] Thread query result:`, threadError ? 'ERROR: ' + threadError.message : 'SUCCESS');
    
    if (threadError) {
      console.error(`[Chat Page] Thread query error:`, threadError);
    } else {
      existingThread = threadData;
      console.log(`[Chat Page] Existing thread:`, existingThread?.thread_id || 'none');
    }
  } catch (e) {
    console.error(`[Chat Page] Thread query exception:`, e);
  }

  console.log(`[Chat Page] All checks passed, rendering ChatInterface`);

  try {
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
  } catch (e) {
    console.error(`[Chat Page] Render error:`, e);
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold text-red-600">렌더링 오류</h1>
        <pre className="mt-2 text-sm">{String(e)}</pre>
      </div>
    );
  }
}