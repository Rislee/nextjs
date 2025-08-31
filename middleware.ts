// middleware.ts - 긴급 복구용 (거의 모든 기능 비활성화)
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API 경로는 항상 통과
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 정적 파일들 통과
  if (pathname.startsWith("/_next/") || 
      pathname.startsWith("/favicon") ||
      pathname.includes(".")) {
    return NextResponse.next();
  }

  // 모든 다른 경로는 일단 통과 (미들웨어에서 차단하지 않음)
  console.log(`[MW] Allowing all routes: ${pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};