// app/api/chat/threads/route.ts - 메시지 불러오기 기능 추가
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    // 세션 기반 사용자 인증
    const ck = await cookies();
    const uid = ck.get("uid")?.value;

    if (!uid) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Supabase에서 사용자 정보 확인
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

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json(
        { error: "invalid_session" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // URL에서 planId 가져오기
    const url = new URL(req.url);
    const planId = url.searchParams.get('planId');

    if (!planId) {
      return NextResponse.json(
        { error: "plan_id_required" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 플랜 권한 확인
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: userPlans } = await supabaseAdmin
      .from("user_plans")
      .select("plan_id, status")
      .eq("user_id", uid)
      .eq("status", "active");

    if (!userPlans || !userPlans.some(p => p.plan_id === planId)) {
      return NextResponse.json(
        { error: "plan_access_denied" },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // 사용자의 쓰레드 목록 조회
    const { data: threads, error } = await supabaseAdmin
      .from("user_threads")
      .select("thread_id, title, first_message, last_message_at, created_at")
      .eq("user_id", uid)
      .eq("plan_id", planId)
      .order("last_message_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Threads query error:", error);
      return NextResponse.json(
        { error: "database_error" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // 각 쓰레드의 메시지 수 조회
    const threadList = await Promise.all(
      (threads || []).map(async (thread, index) => {
        // 각 쓰레드의 메시지 수 조회
        const { count } = await supabaseAdmin
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("thread_id", thread.thread_id)
          .eq("user_id", uid);

        // 마지막 메시지 조회
        const { data: lastMessage } = await supabaseAdmin
          .from("chat_messages")
          .select("content, role, created_at")
          .eq("thread_id", thread.thread_id)
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        return {
          id: thread.thread_id,
          title: thread.title || `대화 ${index + 1}`,
          lastMessage: lastMessage?.content?.substring(0, 50) + (lastMessage?.content?.length > 50 ? '...' : '') || "대화가 시작되지 않았습니다",
          updatedAt: new Date(thread.last_message_at || thread.created_at),
          messageCount: count || 0,
        };
      })
    );

    return NextResponse.json(
      {
        threads: threadList,
        planId,
        userId: uid
      },
      { headers: CORS_HEADERS }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error("Threads API Error:", err.message);
    
    return NextResponse.json(
      { 
        error: "internal_server_error", 
        message: err.message || "An unexpected error occurred"
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}