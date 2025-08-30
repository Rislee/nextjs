// app/api/me/summary/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10; // 10초 타임아웃

export async function GET() {
  try {
    const ck = await cookies();

    // 1) 로그인 사용자 확인 (sb-* 쿠키 기반)
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
    const uid = userData?.user?.id;
    
    if (userErr || !uid) {
      console.log("No authenticated user found");
      return NextResponse.json(
        { ok: false, error: "unauthorized" }, 
        { status: 401 }
      );
    }

    // 2) 서비스 롤 키 확인
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
      return NextResponse.json(
        { ok: false, error: "server_config_error" }, 
        { status: 500 }
      );
    }

    // 3) 서비스 롤로 안전 조회 (RLS 무시)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // Promise.all에 타임아웃 추가
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Database timeout")), 8000)
    );

    const dataPromise = Promise.all([
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

    const [memRes, payRes] = await Promise.race([
      dataPromise,
      timeoutPromise
    ]) as any;

    const membership = memRes?.data ?? null;
    const payments = payRes?.data ?? [];

    return NextResponse.json({ 
      ok: true, 
      membership, 
      payments 
    });
    
  } catch (error: any) {
    console.error("API /me/summary error:", error);
    
    if (error.message === "Database timeout") {
      return NextResponse.json(
        { ok: false, error: "timeout" }, 
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: error?.message || "internal_error" }, 
      { status: 500 }
    );
  }
}