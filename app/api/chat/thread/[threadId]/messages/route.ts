// app/api/chat/thread/[threadId]/messages/route.ts
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
    console.log("=== Thread Messages API called for:", threadId);

    // 세션 기반 사용자 인증
    const ck = await cookies();
    const uid = ck.get("uid")?.value;

    console.log("UID from cookie:", uid ? uid.substring(0, 8) + '...' : 'none');

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
    console.log("User data:", userData.user?.email || 'none');
    
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
    const { data: threadOwnership, error: ownershipError } = await supabaseAdmin
      .from("user_threads")
      .select("plan_id")
      .eq("thread_id", threadId)
      .eq("user_id", uid)
      .maybeSingle();

    console.log("Thread ownership check:", {
      found: !!threadOwnership,
      error: ownershipError?.message || 'none'
    });

    if (ownershipError) {
      console.error("Ownership query error:", ownershipError);
      return NextResponse.json(
        { error: "database_error", detail: ownershipError.message },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    if (!threadOwnership) {
      return NextResponse.json(
        { error: "thread_not_found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // 해당 쓰레드의 메시지들 조회
    console.log("Querying messages for thread:", threadId);
    
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("thread_id", threadId)
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    console.log("Messages query result:", {
      error: messagesError?.message || 'none',
      count: messages?.length || 0
    });

    if (messagesError) {
      console.error("Messages query error:", messagesError);
      return NextResponse.json(
        { error: "database_error", detail: messagesError.message },
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

    console.log("Formatted messages count:", formattedMessages.length);

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
    console.error("Stack trace:", err.stack);
    
    return NextResponse.json(
      { 
        error: "internal_server_error", 
        message: err.message || "An unexpected error occurred"
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}