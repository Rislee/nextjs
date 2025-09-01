// app/api/chat/threads/[threadId]/messages/route.ts
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

export async function GET(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const threadId = params.threadId;

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

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 해당 쓰레드가 사용자의 것인지 확인
    const { data: threadOwnership } = await supabaseAdmin
      .from("user_threads")
      .select("plan_id")
      .eq("thread_id", threadId)
      .eq("user_id", uid)
      .single();

    if (!threadOwnership) {
      return NextResponse.json(
        { error: "thread_not_found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // 해당 쓰레드의 메시지들 조회
    const { data: messages, error } = await supabaseAdmin
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("thread_id", threadId)
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Messages query error:", error);
      return NextResponse.json(
        { error: "database_error" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // 메시지 형태로 변환
    const formattedMessages = (messages || []).map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at),
    }));

    return NextResponse.json(
      {
        messages: formattedMessages,
        threadId,
        planId: threadOwnership.plan_id,
      },
      { headers: CORS_HEADERS }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error("Thread Messages API Error:", err.message);
    
    return NextResponse.json(
      { 
        error: "internal_server_error", 
        message: err.message || "An unexpected error occurred"
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}