// app/api/auth/sync/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "missing_access_token" }, { status: 400 });
  }

  // 서비스 키로 토큰 검증 → user 추출
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user?.id) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }

  const uid = data.user.id;
  const isProd =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  const res = NextResponse.json({ ok: true, uid });
  res.cookies.set({
    name: "uid",
    value: uid,
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    ...(isProd ? { domain: ".inneros.co.kr" } : {}),
  });

  return res;
}
