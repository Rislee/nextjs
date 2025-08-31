// app/api/me/summary/route.ts - 세션 동기화 개선
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
    let user = null;

    console.log("[me/summary] Starting - uid cookie:", uid ? uid.substring(0, 8) + '...' : 'none');

    // 1) 먼저 Supabase 세션으로 시도
    try {
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
      
      if (!userErr && userData?.user?.id) {
        user = userData.user;
        uid = user.id;
        console.log("[me/summary] Supabase session success:", user.email);
      } else {
        console.log("[me/summary] Supabase session failed:", userErr?.message);
      }
    } catch (e: any) {
      console.log("[me/summary] Supabase session error:", e.message);
    }

    // 2) uid 쿠키는 있지만 Supabase 세션이 없는 경우 → 세션 재동기화 필요
    if (uid && !user) {
      console.log("[me/summary] UID exists but no Supabase session - session desync detected");
      
      // /api/session/ensure 호출해서 동기화 시도
      try {
        const ensureUrl = new URL("/api/session/ensure", process.env.NEXT_PUBLIC_SITE_URL || "https://account.inneros.co.kr");
        const ensureRes = await fetch(ensureUrl.toString(), {
          headers: { 
            cookie: Array.from(ck.getAll()).map(c => `${c.name}=${c.value}`).join('; ')
          },
          cache: 'no-store'
        });
        
        console.log("[me/summary] Session ensure result:", ensureRes.status);
        
        if (ensureRes.ok) {
          // 동기화 후 다시 시도
          const supa2 = createServerClient(
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
          
          const { data: userData2, error: userErr2 } = await supa2.auth.getUser();
          if (!userErr2 && userData2?.user?.id) {
            user = userData2.user;
            uid = user.id;
            console.log("[me/summary] Session resync success:", user.email);
          }
        }
      } catch (syncError: any) {
        console.log("[me/summary] Session sync error:", syncError.message);
      }
    }

    // 3) 여전히 사용자가 없으면 401
    if (!uid || !user) {
      console.log("[me/summary] No valid user found, returning 401");
      return NextResponse.json(
        { ok: false, error: "unauthorized", detail: "No valid session or uid cookie" }, 
        { status: 401 }
      );
    }

    // 4) 서비스 롤로 데이터 조회
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[me/summary] SUPABASE_SERVICE_ROLE_KEY is not set");
      return NextResponse.json(
        { ok: false, error: "server_config_error" }, 
        { status: 500 }
      );
    }

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
      console.error("[me/summary] Plans query error:", plansRes.error);
    }
    if (payRes.error) {
      console.error("[me/summary] Payments query error:", payRes.error);
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

    console.log("[me/summary] Success - user:", user.email, "plans:", activePlans.map(p => p.plan_id));

    return NextResponse.json({ 
      ok: true, 
      uid,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      activePlans, // 새로운 다중 플랜 데이터
      membership, // 레거시 호환성
      payments 
    });
    
  } catch (error: any) {
    console.error("[me/summary] API error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "internal_error" }, 
      { status: 500 }
    );
  }
}