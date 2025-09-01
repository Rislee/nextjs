// app/api/chat/thread/route.ts - 디버깅 강화 버전
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
    console.log("=== Thread API called (Enhanced Debug Version) ===");
    
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

    // URL에서 planId 가져오기
    const url = new URL(req.url);
    const planId = url.searchParams.get('planId');
    
    console.log("Plan ID:", planId);

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

    console.log("User plans:", userPlans?.map(p => p.plan_id) || []);

    if (!userPlans || !userPlans.some(p => p.plan_id === planId)) {
      return NextResponse.json(
        { error: "plan_access_denied" },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // === 디버깅 강화: 단계별 조회 ===
    
    // 1. 먼저 user_threads 테이블 전체 확인
    console.log("=== Step 1: 전체 user_threads 확인 ===");
    const { data: allUserThreads, error: allThreadsError } = await supabaseAdmin
      .from("user_threads")
      .select("*")
      .eq("user_id", uid);
    
    console.log("전체 사용자 쓰레드:", {
      error: allThreadsError?.message || 'none',
      count: allUserThreads?.length || 0,
      threads: allUserThreads?.map(t => ({ id: t.thread_id, plan: t.plan_id })) || []
    });

    // 2. 플랜별 쓰레드 확인
    console.log("=== Step 2: 플랜별 쓰레드 확인 ===");
    const { data: planThreads, error: planThreadsError } = await supabaseAdmin
      .from("user_threads")
      .select("*")
      .eq("user_id", uid)
      .eq("plan_id", planId);
      
    console.log("플랜별 쓰레드:", {
      error: planThreadsError?.message || 'none',
      count: planThreads?.length || 0,
      threads: planThreads?.map(t => ({ 
        id: t.thread_id, 
        title: t.title, 
        created: t.created_at,
        last_message: t.last_message_at 
      })) || []
    });

    // 3. chat_messages 테이블도 확인
    console.log("=== Step 3: chat_messages 테이블 확인 ===");
    const { data: allMessages, error: messagesError } = await supabaseAdmin
      .from("chat_messages")
      .select("thread_id, count(*)")
      .eq("user_id", uid)
      .eq("plan_id", planId);
      
    console.log("메시지 테이블:", {
      error: messagesError?.message || 'none',
      data: allMessages || []
    });

    // 4. 정렬과 제한 적용해서 최종 조회
    console.log("=== Step 4: 정렬된 최종 쓰레드 목록 ===");
    const { data: threads, error: threadsError } = await supabaseAdmin
      .from("user_threads")
      .select("thread_id, title, first_message, last_message_at, created_at")
      .eq("user_id", uid)
      .eq("plan_id", planId)
      .order("last_message_at", { ascending: false })
      .limit(50);

    console.log("최종 쓰레드 쿼리 결과:", {
      error: threadsError?.message || 'none',
      count: threads?.length || 0,
      threads: threads?.map(t => ({ 
        id: t.thread_id, 
        title: t.title,
        last_message_at: t.last_message_at,
        created_at: t.created_at
      })) || []
    });

    if (threadsError) {
      console.error("Threads query error:", threadsError);
      return NextResponse.json(
        { error: "database_error", detail: threadsError.message },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // 각 쓰레드의 메시지 수와 마지막 메시지 조회 (병렬 처리)
    const threadList = await Promise.all(
      (threads || []).map(async (thread, index) => {
        console.log(`=== Processing thread ${index + 1}: ${thread.thread_id} ===`);
        
        try {
          // 메시지 수 조회
          const { count, error: countError } = await supabaseAdmin
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("thread_id", thread.thread_id)
            .eq("user_id", uid);

          console.log(`Thread ${thread.thread_id} message count:`, {
            count: count || 0,
            error: countError?.message || 'none'
          });

          // 마지막 메시지 조회
          const { data: lastMessage, error: lastMsgError } = await supabaseAdmin
            .from("chat_messages")
            .select("content, role, created_at")
            .eq("thread_id", thread.thread_id)
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          console.log(`Thread ${thread.thread_id} last message:`, {
            hasMessage: !!lastMessage,
            content: lastMessage?.content?.substring(0, 30) || 'none',
            error: lastMsgError?.message || 'none'
          });

          const result = {
            id: thread.thread_id,
            title: thread.title || thread.first_message?.substring(0, 30) + '...' || `대화 ${index + 1}`,
            lastMessage: lastMessage?.content?.substring(0, 50) + (lastMessage?.content?.length > 50 ? '...' : '') || 
                        thread.first_message?.substring(0, 50) + '...' || "대화가 시작되지 않았습니다",
            updatedAt: new Date(thread.last_message_at || thread.created_at),
            messageCount: count || 0,
          };

          console.log(`Thread ${thread.thread_id} final result:`, {
            id: result.id,
            title: result.title,
            messageCount: result.messageCount,
            updatedAt: result.updatedAt.toISOString()
          });

          return result;
        } catch (error) {
          console.error(`Error processing thread ${thread.thread_id}:`, error);
          return {
            id: thread.thread_id,
            title: thread.title || `대화 ${index + 1}`,
            lastMessage: "오류가 발생했습니다",
            updatedAt: new Date(thread.created_at),
            messageCount: 0,
          };
        }
      })
    );

    console.log("=== Final Results ===");
    console.log("총 처리된 쓰레드 수:", threadList.length);
    console.log("쓰레드 목록:", threadList.map(t => ({ 
      id: t.id, 
      title: t.title, 
      messageCount: t.messageCount 
    })));

    return NextResponse.json(
      {
        threads: threadList,
        planId,
        userId: uid,
        debug: {
          totalUserThreads: allUserThreads?.length || 0,
          planSpecificThreads: planThreads?.length || 0,
          processedThreads: threadList.length
        }
      },
      { headers: CORS_HEADERS }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error("=== Thread API Fatal Error ===");
    console.error("Error message:", err.message);
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