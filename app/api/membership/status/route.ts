// app/api/membership/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const uid = cookieStore.get("uid")?.value;
    if (!uid) {
      return NextResponse.json({ ok: true, userId: null, status: "none" });
    }

    // memberships 조회 (필요 컬럼만)
    const { data, error } = await supabaseAdmin
      .from("memberships")
      .select("status, plan")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      userId: uid,
      status: data?.status ?? "none",
      plan: data?.plan ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://www.inneros.co.kr",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    },
  });
}
