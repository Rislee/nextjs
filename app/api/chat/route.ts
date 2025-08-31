// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 기존 CORS_HEADERS 선언 아래에 추가
export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  console.log("=== Chat API POST request received ===");
  
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json(
        { error: "server_configuration_error" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const body = await request.json();
    const { message, planId, token, threadId } = body; // threadId 추가

    // 토큰 검증
    let tokenData;
    try {
      const tokenStr = Buffer.from(token, 'base64').toString('utf8');
      tokenData = JSON.parse(tokenStr);
      
      if (tokenData.expires && tokenData.expires < Date.now()) {
        return NextResponse.json(
          { error: "token_expired" },
          { status: 401, headers: CORS_HEADERS }
        );
      }

      if (!tokenData.userPlans || !tokenData.userPlans.includes(planId)) {
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

    // Assistant ID 매핑
    const assistantMap: Record<string, string | undefined> = {
      START_OS: process.env.OPENAI_ASSISTANT_START_OS,
      SIGNATURE_OS: process.env.OPENAI_ASSISTANT_SIGNATURE_OS,
      MASTER_OS: process.env.OPENAI_ASSISTANT_MASTER_OS,
    };

    const assistantId = assistantMap[planId];
    if (!assistantId) {
      return NextResponse.json(
        { error: "assistant_not_found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    console.log(`Using assistant ${assistantId} for plan ${planId}`);

    let currentThreadId = threadId;
    let isNewThread = false;

    // Thread 생성 또는 재사용
    if (!currentThreadId) {
      console.log("Creating new thread...");
      
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
      currentThreadId = threadData.id;
      isNewThread = true;
      console.log("New thread created:", currentThreadId);
      
      // Supabase에 thread 저장
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (supabaseUrl && supabaseKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false }
          });
          
          await supabase.from('user_threads').upsert({
            user_id: tokenData.uid,
            plan_id: planId,
            thread_id: currentThreadId,
            last_message_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,plan_id'
          });
          
          console.log("Thread saved to database");
        } catch (dbError) {
          console.error("Failed to save thread:", dbError);
        }
      }
    } else {
      console.log("Using existing thread:", currentThreadId);
      
      // Thread 유효성 확인
      const checkResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });
      
      if (!checkResponse.ok) {
        console.log("Thread not found, creating new one...");
        // Thread가 없으면 새로 생성
        const threadResponse = await fetch('https://api.openai.com/v1/threads', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2',
          },
          body: JSON.stringify({}),
        });
        
        const threadData = await threadResponse.json();
        currentThreadId = threadData.id;
        isNewThread = true;
      }
    }

    // 메시지 추가
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages`, {
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

    // Run 생성 및 실행
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs`, {
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
    
    const runData = await runResponse.json();
    const runId = runData.id;

    // Run 완료 대기
    let runStatus = runData;
    const maxAttempts = 30;
    let attempts = 0;
    
    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      if (attempts >= maxAttempts) {
        throw new Error("Assistant response timeout");
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });
      
      runStatus = await statusResponse.json();
      attempts++;
    }

    if (runStatus.status !== 'completed') {
      throw new Error(`Assistant run failed with status: ${runStatus.status}`);
    }

    // 응답 메시지 조회
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${currentThreadId}/messages`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    });
    
    const messagesData = await messagesResponse.json();
    const assistantMessage = messagesData.data.find((msg: any) => msg.role === 'assistant');

    const responseText = assistantMessage.content
      .filter((content: any) => content.type === "text")
      .map((content: any) => content.text?.value || "")
      .join("\n")
      .trim();

    // 사용량 기록
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
        
        // Thread 최종 메시지 시간 업데이트
        await supabase.from('user_threads').update({
          last_message_at: new Date().toISOString()
        }).eq('user_id', tokenData.uid).eq('plan_id', planId);
        
      } catch (usageError) {
        console.error("Failed to record usage:", usageError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        response: responseText,
        threadId: currentThreadId,
        isNewThread: isNewThread,
        planId: planId,
        timestamp: new Date().toISOString()
      },
      { headers: CORS_HEADERS }
    );

  } catch (error: unknown) {
    const err = error as Error;
    console.error("Chat API Error:", err.message);
    
    return NextResponse.json(
      { 
        error: "internal_server_error", 
        message: err.message || "An unexpected error occurred"
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}