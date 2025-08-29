import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PlanId = 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS';

const PRICE: Record<PlanId, number> = {
  START_OS: 1000,
  SIGNATURE_OS: 11_000_000,
  MASTER_OS: 22_000_000,
};

const CURRENCY: 'KRW' = 'KRW';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const planId = body?.planId as PlanId | undefined;

    if (!planId || !(planId in PRICE)) {
      return NextResponse.json({ ok: false, error: 'invalid_plan' }, { status: 400 });
    }

    const ck = await cookies();
    const uid = ck.get('uid')?.value;
    if (!uid) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const amount = PRICE[planId];
    const orderName = `InnerOS ${planId.replace('_', ' ')}`;
    const merchantUid = `inneros_${planId}_${Date.now()}`;
    const now = new Date().toISOString();

    const ins = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: uid,
        plan_id: planId,
        merchant_uid: merchantUid,
        amount_total: amount,
        currency: CURRENCY,
        status: 'pending',
        created_at: now,
        updated_at: now,
      })
      .select('merchant_uid')
      .maybeSingle();

    if (ins.error) {
      return NextResponse.json(
        { ok: false, error: 'insert_failed', detail: ins.error },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, merchantUid, amount, currency: CURRENCY, orderName },
      { status: 200 }
    );
  } catch (e: any) {
    console.error('checkout/start error', e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'start_failed' },
      { status: 500 }
    );
  }
}
