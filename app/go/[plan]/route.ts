import { NextRequest, NextResponse } from "next/server";
import { PLAN_TO_FRAMER_URL } from "@/lib/plan";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { plan: string } }
) {
  const plan = params.plan as keyof typeof PLAN_TO_FRAMER_URL;
  const url = PLAN_TO_FRAMER_URL[plan];
  if (!url) return NextResponse.redirect(new URL("/", req.url));
  // (원하면 여기서 클릭 로깅 insert 가능)
  return NextResponse.redirect(url);
}
