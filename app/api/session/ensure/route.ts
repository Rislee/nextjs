// app/api/session/ensure/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabaseServer";

// 프리렌더/캐시 방지
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_req: NextRequest) {
  const jar = await cookies();
  let uid = jar.get("uid")?.value || "";

  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";
  const domain = isProd ? ".inneros.co.kr" : undefined;

  // 이미 uid 쿠키가 있으면 연장만 해준다.
  if (uid) {
    const res = NextResponse.json({ ok: true, uid });
    res.cookies.set({
      name: "uid",
      value: uid,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30일
      ...(domain ? { domain } : {}),
    });
    return res;
  }

  // 없으면 Supabase 세션에서 사용자 확인 후 uid 발급
  try {
    const supabase = supabaseServer(); // 내부에서 createServerClient(cookies) 사용
    const { data, error } = await supabase.auth.getUser();
    uid = data?.user?.id || "";

    if (error || !uid) {
      return NextResponse.json(
        { ok: false, error: "no uid cookie" },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ ok: true, uid });
    res.cookies.set({
      name: "uid",
      value: uid,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      ...(domain ? { domain } : {}),
    });
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "ensure failed" },
      { status: 500 }
    );
  }
}

// 선택) 헬스체크용 GET
export async function GET(_req: NextRequest) {
  const jar = await cookies();
  const uid = jar.get("uid")?.value || "";
  if (!uid) return NextResponse.json({ ok: false, error: "no uid" }, { status: 401 });
  return NextResponse.json({ ok: true, uid });
}
