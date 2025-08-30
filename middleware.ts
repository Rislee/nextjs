import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const uid = req.cookies.get("uid")?.value || "";

  // 1) 로그인 상태에서 로그인/회원가입 페이지 접근 시 우회
  if (pathname === "/auth/sign-in" || pathname === "/auth/sign-up") {
    if (uid) {
      const next = req.nextUrl.searchParams.get("next") || "/dashboard";
      return NextResponse.redirect(new URL(next, req.url));
    }
    return NextResponse.next();
  }

  // 2) 보호 경로 게이트 (로그인 필수)
  const protectedPaths = ["/start", "/signature", "/master", "/dashboard"];
  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (isProtected && !uid) {
    const next = encodeURIComponent(pathname + req.nextUrl.search);
    return NextResponse.redirect(new URL(`/auth/sign-in?next=${next}`, req.url));
  }

  return NextResponse.next();
}

// 이 미들웨어는 아래 경로에만 작동합니다(다른 경로/API/정적파일에는 영향 없음)
export const config = {
  matcher: [
    "/start/:path*",
    "/signature/:path*",
    "/master/:path*",
    "/dashboard/:path*",
    "/auth/sign-in",
    "/auth/sign-up",
  ],
};
