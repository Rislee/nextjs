// app/api/auth/logout/route.ts (교체)
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const isProd = process.env.NODE_ENV === "production";
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: 0,
  };

  const res = NextResponse.json({ ok: true });

  // host-only uid 삭제
  res.cookies.set({ name: "uid", value: "", ...base });
  // 도메인 쿠키(uid; .inneros.co.kr) 삭제
  if (isProd) {
    res.cookies.set({ name: "uid", value: "", ...base, domain: ".inneros.co.kr" });
  }

  return res;
}
