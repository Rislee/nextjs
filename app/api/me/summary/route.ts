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
    
    // 먼저 uid 쿠키로 확인 (빠른 경로)
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

    // 서비스 롤 키 확인
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

    const [memRes, payRes] = await Promise.all([
      admin
        .from("memberships")
        .select("plan_id,status,updated_at")
        .eq("user_id", uid)
        .maybeSingle(),
      admin
        .from("payments")
        .select("id,plan_id,status,amount,currency,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    // 에러 체크
    if (memRes.error) {
      console.error("Membership query error:", memRes.error);
    }
    if (payRes.error) {
      console.error("Payments query error:", payRes.error);
    }

    const membership = memRes?.data ?? null;
    const payments = payRes?.data ?? [];

    return NextResponse.json({ 
      ok: true, 
      uid, // 디버깅용
      membership, 
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