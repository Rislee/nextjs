import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const authz = req.headers.get("authorization") ?? "";
    const token = authz.toLowerCase().startsWith("bearer ")
      ? authz.slice(7)
      : null;

    let userId: string | null = null;

    if (token) {
      // ✅ 클라이언트가 보낸 access token으로 사용자 확인
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error) throw error;
      userId = data.user?.id ?? null;
    }

    // 토큰이 없거나 실패 시, 서버 세션 쿠키로도 시도(매직링크 콜백 등)
    if (!userId) {
      const supabase = supabaseServer();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;
      userId = user?.id ?? null;
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Auth session missing!" }, { status: 401 });
    }

    // ✅ uid HttpOnly 쿠키 심기 (로컬 테스트용: secure/domain 생략)
    const jar = await cookies();
    jar.set("uid", userId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      domain: ".inneros.co.kr",
    });

    return NextResponse.json({ ok: true, userId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "ensure failed" }, { status: 500 });
  }
}
