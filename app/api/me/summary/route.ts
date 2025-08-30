// app/api/me/summary/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ck = await cookies();

  // 1) 로그인 사용자 확인 (세션 기반)
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
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2) 서비스 롤로 안전 조회 (RLS 무시)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
      // ⬇️ 여기! descending 대신 ascending:false 사용
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const membership = memRes?.data ?? null;
  const payments = payRes?.data ?? [];

  return NextResponse.json({ ok: true, membership, payments });
}
