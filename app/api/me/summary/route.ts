// app/api/me/summary/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ck = await cookies();
    
    // uid 쿠키로 확인
    let uid = ck.get("uid")?.value;
    
    // uid 쿠키가 없으면 Supabase 세션으로 확인
    if (!uid) {
      const supa = createServerClient(
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

      const { data: userData, error: userErr } = await supa.auth.getUser();
      
      if (userErr || !userData?.user?.id) {
        console.log("No authenticated user found:", userErr?.message);
        return NextResponse.json(
          { ok: false, error: "unauthorized", detail: "No valid session or uid cookie" }, 
          { status: 401 }
        );
      }
      
      uid = userData.user.id;
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
      return NextResponse.json(
        { ok: false, error: "server_config_error" }, 
        { status: 500 }
      );
    }

    // 서비스 롤로 데이터 조회
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // user_plans에서 활성 플랜들 조회
    const [plansRes, payRes] = await Promise.all([
      admin
        .from("user_plans")
        .select("plan_id,status,activated_at,expires_at,updated_at")
        .eq("user_id", uid)
        .eq("status", "active")
        .order("activated_at", { ascending: false }),
      admin
        .from("payments")
        .select("id,plan_id,status,amount,currency,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (plansRes.error) {
      console.error("Plans query error:", plansRes.error);
    }
    if (payRes.error) {
      console.error("Payments query error:", payRes.error);
    }

    const activePlans = plansRes?.data ?? [];
    const payments = payRes?.data ?? [];

    // 레거시 호환성을 위해 첫 번째 플랜을 membership으로도 반환
    const primaryPlan = activePlans[0] || null;
    const membership = primaryPlan ? {
      plan_id: primaryPlan.plan_id,
      status: primaryPlan.status,
      updated_at: primaryPlan.updated_at
    } : null;

    return NextResponse.json({ 
      ok: true, 
      uid,
      activePlans, // 새로운 다중 플랜 데이터
      membership, // 레거시 호환성
      payments 
    });
    
  } catch (error: any) {
    console.error("API /me/summary error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "internal_error" }, 
      { status: 500 }
    );
  }
}