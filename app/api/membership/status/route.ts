import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  // 내부 API 보호용 키 검사
  const key = req.headers.get("x-internal-key");
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!userId) {
    return NextResponse.json({ ok: false, error: "no userId" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("memberships")
    .select("plan_id, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    plan: data?.plan_id ?? "FREE",
    status: data?.status ?? "none",
    currentPeriodEnd: data?.current_period_end ?? null,
  });
}
