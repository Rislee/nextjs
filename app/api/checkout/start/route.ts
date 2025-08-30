// app/api/checkout/start/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PlanId = 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS';

const PRICE: Record<PlanId, number> = {
  START_OS: 5500000,          
  SIGNATURE_OS: 22000000,
  MASTER_OS: 55000000,
};

export async function POST(req: Request) {
  // 0) 입력 검사
  const body = await req.json().catch(() => ({}));
  const planId = body?.planId as PlanId | undefined;
  if (!planId || !(planId in PRICE)) {
    return NextResponse.json({ ok: false, error: 'invalid_plan' }, { status: 400 });
  }

  // 1) 로그인 확인
  const ck = await cookies();
  const uid = ck.get('uid')?.value;
  if (!uid) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  // 2) 현재 멤버십 확인 → 동일 플랜이면 차단 (다른 플랜은 허용)
  const m = await supabaseAdmin
    .from('memberships')
    .select('plan_id,status')
    .eq('user_id', uid)
    .maybeSingle();

  const curPlan = (m.data?.plan_id ?? null) as PlanId | null;
  const curStatus = (m.data?.status ?? 'none') as 'active' | 'past_due' | 'canceled' | 'none';

  // 현재 활성 상태에서 동일한 플랜을 구매하려고 하면 차단
  if (curStatus === 'active' && curPlan === planId) {
    return NextResponse.json(
      { ok: false, error: 'already_active_same_plan', detail: { current: curPlan } },
      { status: 409 }
    );
  }

  // 3) 주문 생성
  const amount = PRICE[planId];
  const orderName = `InnerOS ${planId.replace('_', ' ')}`;
  const merchantUid = `inneros_${planId}_${Date.now()}`;

  const ins = await supabaseAdmin
    .from('payments')
    .insert({
      user_id: uid,
      plan_id: planId,
      merchant_uid: merchantUid,
      amount,
      currency: 'KRW',
      status: 'pending',
    })
    .select('merchant_uid')
    .maybeSingle();

  if (ins.error) {
    return NextResponse.json(
      { ok: false, error: 'insert_failed', detail: ins.error },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, merchantUid, amount, orderName }, { status: 200 });
}