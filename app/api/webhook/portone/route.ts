// app/api/webhook/portone/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  // 원본 텍스트(서명검증 시 필요)
  const raw = await req.text();
  console.log("[portone:webhook] headers=", Object.fromEntries(req.headers));
  console.log("[portone:webhook] raw=", raw);

  // 🔴 일단 200을 무조건 반환 (연결 확인용)
  return NextResponse.json({ ok: true });
}

export async function GET() {
  // 테스트로 GET이 오면 405 명확히
  return NextResponse.json({ ok: false, error: "Use POST" }, { status: 405 });
}
