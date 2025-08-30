import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // uid 쿠키 제거
  res.cookies.set({
    name: "uid",
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    ...(process.env.NODE_ENV === "production" ? { domain: ".inneros.co.kr" } : {}),
  });
  return res;
}
