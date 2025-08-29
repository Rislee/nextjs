// app/api/checkout/start/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PlanId = 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS';

const PRICE: Record<PlanId, number> = {
  START_OS: 1000,          // 테스트 금액
  SIGNATURE_OS: 11000000,
  MASTER_OS: 22000000,
};

function orderNameFor(planId: PlanId) {
  return `InnerOS ${planId.replace('_', ' ')}`;
}

export async function POST(req: Request) {
  const { planId }: { planId?: PlanId } = await req.json().catch(() => ({}));
  if (!planId || !(planId in PRICE)) {
    return NextResponse.json({ ok: false, error: 'invalid_plan' }, { status: 400 });
  }

  // 쿠키에서 uid 확인
  const jar = await cookies();
  const uid = jar.get('uid')?.value;
  if (!uid) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const merchantUid = `inneros_${planId}_${Date.now()}`;
  const amount = PRICE[planId];
  const orderName = orderNameFor(planId);

  // payments pending 행 삽입
  const ins = await supabaseAdmin
    .from('payments')
    .insert({
      user_id: uid,
      plan_id: planId,
      merchant_uid: merchantUid,
      status: 'pending',
      amount,
      currency: 'KRW',
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
