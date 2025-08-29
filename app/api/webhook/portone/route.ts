import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getV1AccessToken, getV1Payment } from '@/lib/portone/v1';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const impUid = body?.imp_uid || body?.impUid || body?.payment_id || body?.paymentId;
    if (!impUid) {
      return NextResponse.json({ ok: false, error: 'missing_imp_uid' }, { status: 400 });
    }

    const token = await getV1AccessToken();
    const pay = await getV1Payment(impUid, token);
    const now = new Date().toISOString();

    // payments 업데이트
    const up = await supabaseAdmin
      .from('payments')
      .update({
        status: pay.status === 'paid' ? 'paid' : (pay.status as any),
        portone_payment_id: pay.imp_uid,
        amount: pay.amount,
        currency: pay.currency ?? 'KRW',
        failure: pay.status === 'failed' ? { reason: pay.fail_reason || 'failed' } : null,
        updated_at: now,
      })
      .eq('merchant_uid', pay.merchant_uid)
      .select('user_id, plan_id')
      .maybeSingle();

    let userId: string | null = up.data ? ((up.data as any).user_id || null) : null;
    let planId: string | null = up.data ? ((up.data as any).plan_id || null) : null;

    // 없으면 삽입 (경계 상황)
    if (!up.data) {
      const ins = await supabaseAdmin
        .from('payments')
        .insert({
          merchant_uid: pay.merchant_uid,
          portone_payment_id: pay.imp_uid,
          status: pay.status === 'paid' ? 'paid' : (pay.status as any),
          amount: pay.amount,
          currency: pay.currency ?? 'KRW',
          failure: pay.status === 'failed' ? { reason: pay.fail_reason || 'failed' } : null,
          updated_at: now,
        })
        .select('user_id, plan_id')
        .maybeSingle();
      if (!ins.error) {
        userId = (ins.data as any)?.user_id || null;
        planId = (ins.data as any)?.plan_id || null;
      }
    }

    // 멤버십 활성화
    if (pay.status === 'paid' && userId && planId) {
      await supabaseAdmin
        .from('memberships')
        .upsert(
          { user_id: userId, plan_id: planId, status: 'active', updated_at: now },
          { onConflict: 'user_id' },
        );
    }

    return NextResponse.json({ ok: true, status: pay.status });
  } catch (e: any) {
    console.error('webhook v1 error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'webhook_failed' }, { status: 500 });
  }
}
