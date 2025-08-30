// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OpenAI 클라이언트를 런타임에만 초기화
let openai: any = null;

function getOpenAIClient() {
  if (!openai) {
    const OpenAI = require('openai');
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }
  return openai;
}

// 플랜별 설정
const PLAN_CONFIG = {
  START_OS: {
    dailyLimit: 100,
    assistant_id: process.env.OPENAI_ASSISTANT_START_OS!,
    title: "START OS AI Assistant"
  },
  SIGNATURE_OS: {
    dailyLimit: 300,
    assistant_id: process.env.OPENAI_ASSISTANT_SIGNATURE_OS!,
    title: "SIGNATURE OS AI Assistant"
  },
  MASTER_OS: {
    dailyLimit: 500,
    assistant_id: process.env.OPENAI_ASSISTANT_MASTER_OS!,
    title: "MASTER OS AI Assistant"
  }
} as const;

type PlanId = keyof typeof PLAN_CONFIG;

// CORS 헤더
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
    // 환경변수 확인
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is missing");
      return NextResponse.json(
        { error: "server_configuration_error" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const { message, planId, token } = await req.json();

    // 1. 입력 검증
    if (!message || !planId || !token) {
      return NextResponse.json(
        { error: "missing_required_fields" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!(planId in PLAN_CONFIG)) {
      return NextResponse.json(
        { error: "invalid_plan" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 2. 토큰 검증 및 사용자 정보 추출
    let userId: string;
    let userPlans: string[];
    
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
      userPlans = tokenData.userPlans || [];
      
      // 플랜 권한 확인
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

    // 3. 일일 사용량 확인
    const today = new Date().toISOString().split('T')[0];
    const config = PLAN_CONFIG[planId as PlanId];
    
    const { data: usage } = await supabaseAdmin
      .from("chat_usage")
      .select("turn_count")
      .eq("user_id", userId)
      .eq("plan_id", planId)
      .eq("date", today)
      .maybeSingle();

    const currentUsage = usage?.turn_count || 0;
    
    if (currentUsage >= config.dailyLimit) {
      return NextResponse.json(
        { 
          error: "daily_limit_exceeded",
          remaining: 0,
          resetTime: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
        },
        { status: 429, headers: CORS_HEADERS }
      );
    }

    // 4. OpenAI 클라이언트 초기화 및 쓰레드 처리
    const openaiClient = getOpenAIClient();
    let threadId: string;
    
    const { data: threadData } = await supabaseAdmin
      .from("chat_threads")
      .select("thread_id")
      .eq("user_id", userId)
      .eq("plan_id", planId)
      .maybeSingle();

    if (threadData?.thread_id) {
      threadId = threadData.thread_id;
    } else {
      // 새 쓰레드 생성
      const thread = await openaiClient.beta.threads.create();
      threadId = thread.id;
      
      // DB에 저장
      await supabaseAdmin
        .from("chat_threads")
        .upsert({
          user_id: userId,
          plan_id: planId,
          thread_id: threadId,
          updated_at: new Date().toISOString()
        });
    }

    // 5. 메시지 추가 및 실행
    await openaiClient.beta.threads.messages.create(threadId, {
      role: "user",
      content: message
    });

    const run = await openaiClient.beta.threads.runs.create(threadId, {
      assistant_id: config.assistant_id
    });

    // 6. 실행 완료 대기
    let runStatus = await openaiClient.beta.threads.runs.retrieve(run.id, {
      thread_id: threadId
    });
    
    let attempts = 0;
    const maxAttempts = 30; // 30초 최대 대기
    
    while ((runStatus.status === 'in_progress' || runStatus.status === 'queued') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openaiClient.beta.threads.runs.retrieve(run.id, {
        thread_id: threadId
      });
      attempts++;
    }

    if (runStatus.status !== 'completed') {
      console.error("AI run failed:", runStatus.status, runStatus.last_error);
      return NextResponse.json(
        { error: "ai_processing_failed", status: runStatus.status },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // 7. 응답 메시지 가져오기
    const messages = await openaiClient.beta.threads.messages.list(threadId, {
      order: 'desc',
      limit: 1
    });

    const assistantMessage = messages.data[0];
    const responseText = assistantMessage.content
      .filter((content: any) => content.type === 'text')
      .map((content: any) => content.text.value)
      .join('\n');

    // 8. 사용량 증가
    await supabaseAdmin
      .from("chat_usage")
      .upsert({
        user_id: userId,
        plan_id: planId,
        date: today,
        turn_count: currentUsage + 1,
        updated_at: new Date().toISOString()
      });

    // 9. 대화 기록 저장 (선택사항)
    try {
      await supabaseAdmin
        .from("chat_conversations")
        .insert({
          user_id: userId,
          plan_id: planId,
          thread_id: threadId,
          user_message: message,
          assistant_message: responseText
        });
    } catch (e) {
      // 대화 기록 저장 실패해도 응답은 반환
      console.error("Failed to save conversation:", e);
    }

    // 10. 응답 반환
    const remaining = config.dailyLimit - currentUsage - 1;
    
    return NextResponse.json(
      {
        message: responseText,
        remaining,
        planTitle: config.title,
        dailyLimit: config.dailyLimit
      },
      { headers: CORS_HEADERS }
    );

  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "internal_server_error", detail: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}