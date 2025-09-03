// app/api/checkout/start/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { PLAN_PRICING } from '@/lib/pricing'; // 중앙화된 가격 import

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PlanId = 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS';

export async function POST(req: Request) {
  // 0) 입력 검사
  const body = await req.json().catch(() => ({}));
  const planId = body?.planId as PlanId | undefined;
  if (!planId || !(planId in PLAN_PRICING)) {
    return NextResponse.json({ ok: false, error: 'invalid_plan' }, { status: 400 });
  }

  // 1) 로그인 확인
  const ck = await cookies();
  const uid = ck.get('uid')?.value;
  if (!uid) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  // 2) 현재 멤버십 확인
  const m = await supabaseAdmin
    .from('memberships')
    .select('plan_id,status')
    .eq('user_id', uid)
    .maybeSingle();

  const curPlan = (m.data?.plan_id ?? null) as PlanId | null;
  const curStatus = (m.data?.status ?? 'none') as 'active' | 'past_due' | 'canceled' | 'none';

  if (curStatus === 'active' && curPlan === planId) {
    return NextResponse.json(
      { ok: false, error: 'already_active_same_plan', detail: { current: curPlan } },
      { status: 409 }
    );
  }

  // 3) 주문 생성 - 중앙화된 가격 사용
  const amount = PLAN_PRICING[planId].actualPrice; // 실제 결제 금액
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

  console.log('Order created:', { 
    planId, 
    displayPrice: PLAN_PRICING[planId].discountPrice,
    actualPrice: amount,
    merchantUid 
  });

  return NextResponse.json({ ok: true, merchantUid, amount, orderName }, { status: 200 });
}