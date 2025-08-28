import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "missing userId" }, { status: 400 });
    }

    // 간단한 오리진 체크 (원하면 제거/보강)
    const origin = req.headers.get("origin") ?? "";
    if (process.env.NODE_ENV !== "development") {
      const allow = (process.env.NEXT_PUBLIC_SITE_URL ?? "").toLowerCase();
      if (allow && !origin.toLowerCase().startsWith(allow)) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
    }

    // memberships 조회
    const { data: m } = await supabaseAdmin
      .from("memberships")
      .select("status, plan_id, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();

    if (!m) {
      return NextResponse.json({ ok: true, data: { status: "none" } });
    }

    return NextResponse.json({ ok: true, data: m });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "poll failed" }, { status: 500 });
  }
}
