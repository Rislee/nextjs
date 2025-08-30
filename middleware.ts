// middleware.ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ✅ 인증/정적/API는 완전 우회
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // ✅ 멤버 전용 페이지만 게이트
  const protectedPaths = ["/start", "/signature", "/master"];
  const isProtected = protectedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isProtected) return NextResponse.next();

  const uid = req.cookies.get("uid")?.value;
  if (!uid) {
    const next = encodeURIComponent(pathname + search);
    return NextResponse.redirect(new URL(`/auth/sign-in?next=${next}`, req.url));
  }

  // 필요 시 여기서 /api/membership/status 호출해 플랜 레벨 체크도 가능
  return NextResponse.next();
}

// ✅ matcher: 보호 경로만 감시
export const config = {
  matcher: ["/start/:path*", "/signature/:path*", "/master/:path*", "/dashboard/:path*"],
};


