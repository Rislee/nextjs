import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// plan/status 기본값 타입
type Plan = 'FREE' | 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS';
type Status = 'active' | 'past_due' | 'canceled' | 'none';

function toPlan(val: any): Plan {
  const v = String(val || '').toUpperCase();
  if (v === 'START_OS' || v === 'SIGNATURE_OS' || v === 'MASTER_OS') return v;
  return 'FREE';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const paramUserId = url.searchParams.get('userId') || undefined;

  const isInternal =
    req.headers.get('x-internal-key') &&
    req.headers.get('x-internal-key') === process.env.INTERNAL_API_KEY;

  // 내부 호출이면 ?userId 허용, 그 외엔 uid 쿠키 사용
  let userId: string | undefined = undefined;

  if (isInternal && paramUserId) {
    userId = paramUserId;
  } else {
    const ck = await cookies(); // TS 이슈 회피
    userId = ck.get('uid')?.value;
  }

  if (!userId) {
    return NextResponse.json({ plan: 'FREE', status: 'none' }, { status: 200 }); // 게스트
  }

  // memberships에서 최신 1건 조회
  const m = await supabaseAdmin
    .from('memberships')
    .select('plan_id, status, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (m.error) {
    // 에러시에도 API는 항상 200 + 안전한 기본값 리턴 (프론트/프레이머에서 단순 분기 용이)
    return NextResponse.json({ plan: 'FREE', status: 'none', detail: 'db_error' }, { status: 200 });
  }

  const plan = toPlan(m.data?.plan_id);
  const status: Status = (m.data?.status as Status) || 'none';

  return NextResponse.json({ plan, status }, { status: 200 });
}
