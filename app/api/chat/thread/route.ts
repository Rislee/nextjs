// app/api/chat/thread/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function POST(req: NextRequest) {
  try {
    const { token, planId } = await req.json();

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
    } catch (e) {
      return NextResponse.json(
        { error: "invalid_token" },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Supabase에서 기존 thread 조회
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { threadId: null },
        { headers: CORS_HEADERS }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    
    const { data } = await supabase
      .from('user_threads')
      .select('thread_id')
      .eq('user_id', tokenData.uid)
      .eq('plan_id', planId)
      .maybeSingle();

    return NextResponse.json(
      {
        threadId: data?.thread_id || null
      },
      { headers: CORS_HEADERS }
    );

  } catch (error: any) {
    console.error("Thread API error:", error);
    return NextResponse.json(
      { error: "internal_server_error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}