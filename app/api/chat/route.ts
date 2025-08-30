// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS(request: NextRequest) {
  return new Response(null, { 
    status: 200, 
    headers: CORS_HEADERS 
  });
}

export async function POST(request: NextRequest) {
  console.log("=== Chat API POST request received ===");
  
  try {
    // 1. 환경변수 체크 - 런타임에만
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.error("OPENAI_API_KEY is missing");
      return NextResponse.json(
        { 
          error: "server_configuration_error", 
          message: "OpenAI API key not configured" 
        },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // 2. 요청 바디 파싱
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "invalid_json", message: "Request body is not valid JSON" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    console.log("Request body received:", {
      hasMessage: !!body.message,
      hasPlanId: !!body.planId,
      hasToken: !!body.token
    });

    const { message, planId, token } = body;

    // 3. 필수 필드 체크
    if (!message || !planId || !token) {
      return NextResponse.json(
        { 
          error: "missing_fields", 
          missing: {
            message: !message,
            planId: !planId,  
            token: !token
          }
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 4. 토큰 검증
    let tokenData;
    try {
      const tokenStr = Buffer.from(token, 'base64').toString('utf8');
      tokenData = JSON.parse(tokenStr);
      
      // 만료 시간 체크
      if (tokenData.expires && tokenData.expires < Date.now()) {
        return NextResponse.json(
          { error: "token_expired", message: "Access token has expired" },
          { status: 401, headers: CORS_HEADERS }
        );
      }

      // 플랜 권한 체크
      if (!tokenData.userPlans || !tokenData.userPlans.includes(planId)) {
        return NextResponse.json(
          { error: "plan_access_denied", message: "No access to requested plan" },
          { status: 403, headers: CORS_HEADERS }
        );
      }

      console.log("Token validated successfully for user:", tokenData.uid);
      
    } catch (e: unknown) {
      const error = e as Error;
      console.error("Token validation error:", error.message);
      return NextResponse.json(
        { error: "invalid_token", message: "Token validation failed" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // 5. OpenAI 클라이언트 초기화 (런타임에만)
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: openaiKey,
    });

    // 6. Assistant ID 매핑
    const assistantMap: Record<string, string | undefined> = {
      START_OS: process.env.OPENAI_ASSISTANT_START_OS,
      SIGNATURE_OS: process.env.OPENAI_ASSISTANT_SIGNATURE_OS,
      MASTER_OS: process.env.OPENAI_ASSISTANT_MASTER_OS,
    };

    const assistantId = assistantMap[planId];
    if (!assistantId) {
      console.error(`No assistant configured for plan: ${planId}`);
      return NextResponse.json(
        { error: "assistant_not_found", message: "No assistant available for this plan" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`Using assistant ${assistantId} for plan ${planId}`);

    // 7. OpenAI 직접 API 호출로 변경 (SDK 문제 우회)
    console.log("Starting OpenAI API calls...");
    
    let threadId: string;
    let runId: string;
    
    try {
      // Thread 생성
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({}),
      });
      
      if (!threadResponse.ok) {
        throw new Error(`Thread creation failed: ${threadResponse.status}`);
      }
      
      const threadData = await threadResponse.json();
      threadId = threadData.id;
      console.log("Thread created:", threadId);

      // 메시지 추가
      const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({
          role: 'user',
          content: message,
        }),
      });
      
      if (!messageResponse.ok) {
        throw new Error(`Message creation failed: ${messageResponse.status}`);
      }
      
      console.log("Message added to thread");

      // Run 생성
      const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
        body: JSON.stringify({
          assistant_id: assistantId,
        }),
      });
      
      if (!runResponse.ok) {
        throw new Error(`Run creation failed: ${runResponse.status}`);
      }
      
      const runData = await runResponse.json();
      runId = runData.id;
      console.log("Run created:", runId);

      // Run 상태 체크
      const maxAttempts = 30;
      let attempts = 0;
      let runStatus = runData;
      
      while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
        if (attempts >= maxAttempts) {
          throw new Error("Assistant response timeout");
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'OpenAI-Beta': 'assistants=v2',
          },
        });
        
        if (!statusResponse.ok) {
          throw new Error(`Status check failed: ${statusResponse.status}`);
        }
        
        runStatus = await statusResponse.json();
        attempts++;
        console.log(`Run status check ${attempts}: ${runStatus.status}`);
      }

      if (runStatus.status !== 'completed') {
        console.error("Assistant run failed:", runStatus.status, runStatus.last_error);
        throw new Error(`Assistant run failed with status: ${runStatus.status}`);
      }

      // 응답 메시지 조회
      const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });
      
      if (!messagesResponse.ok) {
        throw new Error(`Messages retrieval failed: ${messagesResponse.status}`);
      }
      
      const messagesData = await messagesResponse.json();
      const assistantMessage = messagesData.data.find((msg: any) => msg.role === 'assistant');

      if (!assistantMessage) {
        throw new Error("No assistant response found");
      }

      const responseText = assistantMessage.content
        .filter((content: any) => content.type === "text")
        .map((content: any) => content.text?.value || "")
        .join("\n")
        .trim();

      console.log("Assistant response received, length:", responseText.length);

      // 8. 사용량 기록 (Supabase 사용 가능한 경우)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (supabaseUrl && supabaseKey && tokenData.uid) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false }
          });
          
          const today = new Date().toISOString().split('T')[0];
          
          await supabase.rpc('increment_chat_usage', {
            p_user_id: tokenData.uid,
            p_plan_id: planId,
            p_date: today
          });
          
          console.log("Usage recorded successfully");
        } catch (usageError) {
          console.error("Failed to record usage:", usageError);
          // 사용량 기록 실패해도 응답은 계속 진행
        }
      }

      // 9. 성공 응답
      return NextResponse.json(
        {
          success: true,
          response: responseText,
          planId: planId,
          timestamp: new Date().toISOString(),
          thread_id: threadId
        },
        { headers: CORS_HEADERS }
      );

    } catch (openaiError: unknown) {
      const err = openaiError as Error;
      console.error("OpenAI API Error:", err.message);
      throw err;
    }

  } catch (error: unknown) {
    const err = error as Error;
    console.error("Chat API Error:", err.message, err.stack);
    
    return NextResponse.json(
      { 
        error: "internal_server_error", 
        message: err.message || "An unexpected error occurred",
        timestamp: new Date().toISOString()
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// GET 메소드는 지원하지 않음
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: "method_not_allowed", message: "Only POST method is supported" },
    { status: 405, headers: CORS_HEADERS }
  );
}