// app/api/chat/remaining/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PLAN_LIMITS = {
  START_OS: 100,
  SIGNATURE_OS: 300,
  MASTER_OS: 500
} as const;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const { planId, token } = await req.json();

    if (!planId || !token) {
      return NextResponse.json(
        { error: "missing_fields" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 토큰 검증
    let userId: string;
    try {
      const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
      const now = Date.now();
      
      if (tokenData.expires < now) {
        return NextResponse.json(
          { error: "token_expired" },
          { status: 401, headers: CORS_HEADERS }
        );
      }
      
      userId = tokenData.uid;
      const userPlans = tokenData.userPlans || [];
      
      if (!userPlans.includes(planId)) {
        return NextResponse.json(
          { error: "plan_access_denied" },
          { status: 403, headers: CORS_HEADERS }
        );
      }
      
    } catch (e) {
      return NextResponse.json(
        { error: "invalid_token" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // 오늘 사용량 조회
    const today = new Date().toISOString().split('T')[0];
    const { data: usage } = await supabaseAdmin
      .from("chat_usage")
      .select("turn_count")
      .eq("user_id", userId)
      .eq("plan_id", planId)
      .eq("date", today)
      .maybeSingle();

    const used = usage?.turn_count || 0;
    const limit = PLAN_LIMITS[planId as keyof typeof PLAN_LIMITS];
    const remaining = Math.max(0, limit - used);
    
    // 다음 리셋 시간 (내일 00:00)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return NextResponse.json(
      {
        remaining,
        used,
        limit,
        resetTime: tomorrow.toISOString(),
        planId
      },
      { headers: CORS_HEADERS }
    );

  } catch (error: any) {
    console.error("Remaining API error:", error);
    return NextResponse.json(
      { error: "internal_server_error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}