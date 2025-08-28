import { NextResponse } from "next/server";
// ...필요 import

const ALLOW_ORIGIN = [
  "https://www.inneros.co.kr", // Framer 커스텀 도메인
  "https://inneros.framer.website" // (프리뷰 쓰면 추가)
];

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": ALLOW_ORIGIN.join(", "),
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const headers = new Headers({
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": ALLOW_ORIGIN.includes(origin) ? origin : ALLOW_ORIGIN[0],
    "Vary": "Origin",
    "Content-Type": "application/json",
  });

  // ⬇️ 여기서 uid HttpOnly 쿠키 파싱 → DB 조회
  // 예: const uid = cookies().get('uid')?.value
  // const { status, plan } = await getMembershipByUid(uid);

  // 예시 응답
  return new NextResponse(JSON.stringify({ status: "active", plan: "START_OS" }), { headers });
}
