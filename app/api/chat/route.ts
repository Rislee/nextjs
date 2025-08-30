// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function OPTIONS() {
  return new Response(null, { 
    status: 200, 
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    console.log("POST request received");
    
    // 환경변수 체크
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not found" },
        { status: 500 }
      );
    }
    
    const body = await req.json();
    console.log("Request body:", body);
    
    const { message, planId, token } = body;
    
    if (!message || !planId || !token) {
      return NextResponse.json(
        { error: "missing_fields", received: { message: !!message, planId: !!planId, token: !!token } },
        { status: 400 }
      );
    }
    
    // 토큰 파싱 테스트
    let tokenData;
    try {
      tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
      console.log("Token parsed:", tokenData);
    } catch (e: any) {
      return NextResponse.json(
        { error: "invalid_token", detail: e.message },
        { status: 400 }
      );
    }
    
    // 일단 성공 응답 (OpenAI 호출 없이)
    return NextResponse.json({
      status: "success",
      message: "API is working but not calling OpenAI yet",
      received: { message, planId },
      tokenData,
      env_check: {
        has_openai_key: !!process.env.OPENAI_API_KEY,
        has_start_assistant: !!process.env.OPENAI_ASSISTANT_START_OS,
        has_signature_assistant: !!process.env.OPENAI_ASSISTANT_SIGNATURE_OS,
        has_master_assistant: !!process.env.OPENAI_ASSISTANT_MASTER_OS,
      }
    });
    
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "server_error", detail: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}