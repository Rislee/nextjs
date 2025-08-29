import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id || '';

  const url = new URL(req.url);
  const next = url.searchParams.get('next');

  // ✅ 쿠키 보조
  const returnToCookie = req.cookies.get('returnTo')?.value;
  const returnTo = returnToCookie ? decodeURIComponent(returnToCookie) : '';

  const dest = new URL(next || returnTo || '/checkout', url);

  // 한 response 객체에 쿠키 세팅 + 리다이렉트
  const res = NextResponse.redirect(dest);

  const isProd =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

  if (uid) {
    res.cookies.set({
      name: 'uid',
      value: uid,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      ...(isProd ? { domain: '.inneros.co.kr' } : {}),
    });
    // ✅ 보조 쿠키 제거
    if (returnToCookie) res.cookies.delete('returnTo');
    return res;
  }

  // uid가 없으면 로그인 화면으로 되돌리되 next 유지
  const back = new URL('/auth/sign-in', url);
  if (next) back.searchParams.set('next', next);
  return NextResponse.redirect(back);
}
