import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();                     // ✅ await
  const uid = cookieStore.get("uid")?.value;

  if (!uid) {
    return NextResponse.json({ ok: false, error: "no uid cookie" }, { status: 401 });
  }

  // ✅ 쿠키 설정은 response.cookies.set(...) 사용
  const res = NextResponse.json({ ok: true });
  res.cookies.set("uid", uid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    domain: ".inneros.co.kr",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
