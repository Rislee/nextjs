// middleware.ts (교체)
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const uid = req.cookies.get("uid")?.value || "";
  const hasUid = !!uid;
  const hasSb = req.cookies.getAll().some((c) => c.name.startsWith("sb-") && !!c.value);

  // 1) 로그인/회원가입 페이지: "진짜 로그인 상태"면 우회
  const isAuthPage = pathname === "/auth/sign-in" || pathname === "/auth/sign-up";
  if (isAuthPage) {
    if (hasUid && hasSb) {
      const next = req.nextUrl.searchParams.get("next") || "/dashboard";
      return NextResponse.redirect(new URL(next, req.url));
    }
    return NextResponse.next();
  }

  // 2) 보호 경로 (로그인 필수)
  const protectedPaths = ["/start", "/signature", "/master", "/dashboard"];
  const isProtected = protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (isProtected && !hasUid) {
    const next = encodeURIComponent(pathname + req.nextUrl.search);
    return NextResponse.redirect(new URL(`/auth/sign-in?next=${next}`, req.url));
  }

  return NextResponse.next();
}

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
