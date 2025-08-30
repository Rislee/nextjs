// app/api/session/ensure/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBearer(req: NextRequest) {
  const auth = (req.headers.get("authorization") || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const alt =
    (req.headers.get("x-supabase-auth") ||
      req.headers.get("x-sb-token") ||
      "").trim();
  return alt;
}

export async function GET(req: NextRequest) {
  const ck = await cookies();
  const res = NextResponse.json({ ok: true });

  let uid: string | null = null;

  // 1) 우선 Authorization Bearer 토큰이 오면 그걸로 인증
  const bearer = getBearer(req);
  if (bearer) {
    const cli = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
        auth: { persistSession: false },
      }
    );
    const { data } = await cli.auth.getUser();
    uid = data?.user?.id ?? null;
  }

  // 2) 없으면(혹은 실패하면) 쿠키 기반으로 재시도
  if (!uid) {
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => ck.get(name)?.value,
          set: (name: string, value: string, options: any) => {
            res.cookies.set({ name, value, ...options });
          },
          remove: (name: string, options: any) => {
            res.cookies.set({ name, value: "", ...options, maxAge: 0 });
          },
        },
      }
    );
    const { data } = await supa.auth.getUser();
    uid = data?.user?.id ?? null;
  }

  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });

  // 3) uid 쿠키를 host-only와 .inneros.co.kr 모두에 설정 (우선순위 충돌 방지)
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";

  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };

  // host-only
  res.cookies.set({ name: "uid", value: uid, ...base });
  // domain cookie
  if (isProd) {
    res.cookies.set({
      name: "uid",
      value: uid,
      ...base,
      domain: ".inneros.co.kr",
    });
  }

  return res;
}
