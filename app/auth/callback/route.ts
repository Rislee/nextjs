import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const supabase = supabaseServer(); // 반드시 req의 쿠키를 붙여주는 구현이어야 함 (@supabase/ssr 기반)
  const { data } = await supabase.auth.getUser();
  const uid = data?.user?.id || '';

  const url = new URL(req.url);
  const next = url.searchParams.get('next');
  const dest = next ? new URL(next) : new URL('/checkout', url);

  // 리다이렉트 response 객체를 먼저 만들고, 여기에 쿠키를 심는다.
  const res = NextResponse.redirect(dest);

  // 운영 여부
  const isProd =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

  if (uid) {
    res.cookies.set({
      name: 'uid',
      value: uid,
      httpOnly: true,
      // 같은 사이트( apex ↔ subdomain ) 간 네비게이션이면 Lax도 충분.
      // 만약 크로스사이트 임베드/요청을 고려하면 'none'으로 조정.
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      ...(isProd ? { domain: '.inneros.co.kr' } : {}),
    });
    return res;
  }

  // uid가 없으면 로그인 페이지로 되돌리되 next 유지
  const back = new URL('/auth/sign-in', url);
  if (next) back.searchParams.set('next', next);
  return NextResponse.redirect(back);
}
