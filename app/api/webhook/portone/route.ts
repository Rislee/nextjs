// app/api/webhook/portone/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ✅ PortOne가 뭘 보내든 일단 2xx로 돌려주며, 로그만 찍음
export async function POST(req: NextRequest) {
  const raw = await req.text();
  console.log("[portone:webhook] HIT POST", req.url);
  console.log("[portone:webhook] headers =", Object.fromEntries(req.headers));
  console.log("[portone:webhook] body =", raw);
  return new NextResponse("ok", { status: 200, headers: { "x-webhook": "ok" } });
}

// PortOne가 사전 체크로 HEAD/GET을 칠 수도 있으니 전부 2xx로
export async function HEAD() {
  console.log("[portone:webhook] HIT HEAD");
  return new NextResponse(null, { status: 200 });
}
export async function GET(req: NextRequest) {
  console.log("[portone:webhook] HIT GET", req.url);
  return NextResponse.json({ ok: true, method: "GET" }, { status: 200 });
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
