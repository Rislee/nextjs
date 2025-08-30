// app/api/webhook/portone/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getV1AccessToken, getV1Payment } from '@/lib/portone/v1';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}));
    const imp_uid = json?.imp_uid || json?.impUid || json?.data?.imp_uid;
    if (!imp_uid) return NextResponse.json({ ok: false, error: 'missing_imp_uid' }, { status: 400 });

    const token = await getV1AccessToken();
    const pay = await getV1Payment(imp_uid, token);

    // 주문 찾기
    const q = await supabaseAdmin
      .from('payments')
      .select('id, user_id, plan_id, status')
      .eq('merchant_uid', pay.merchant_uid)
      .maybeSingle();

    if (q.error || !q.data) {
      return NextResponse.json({ ok: false, step: 'payments.select', detail: q.error || 'not_found' }, { status: 404 });
    }

    // 상태별 반영
    if (pay.status === 'paid') {
      // payments
      const up = await supabaseAdmin
        .from('payments')
        .update({
          status: 'paid',
          portone_payment_id: pay.imp_uid,
          amount: pay.amount ?? null,
          currency: pay.currency ?? 'KRW',
          failure: null,
          updated_at: new Date().toISOString(),
        })
        .eq('merchant_uid', pay.merchant_uid)
        .select('id');

      if (up.error) {
        return NextResponse.json({ ok: false, step: 'payments.update', detail: up.error }, { status: 500 });
      }

      // memberships
      const up2 = await supabaseAdmin
        .from('memberships')
        .upsert(
          { user_id: q.data.user_id, plan_id: q.data.plan_id, status: 'active', updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      if (up2.error) {
        return NextResponse.json({ ok: false, step: 'memberships.upsert', detail: up2.error }, { status: 500 });
      }

      return NextResponse.json({ ok: true, status: 'paid' });
    }

    if (pay.status === 'failed' || pay.status === 'cancelled') {
      await supabaseAdmin
        .from('payments')
        .update({
          status: pay.status,
          portone_payment_id: pay.imp_uid,
          failure: { reason: pay.fail_reason || null },
          updated_at: new Date().toISOString(),
        })
        .eq('merchant_uid', pay.merchant_uid);

      return NextResponse.json({ ok: true, status: pay.status });
    }

    // 기타 상태는 통과
    return NextResponse.json({ ok: true, status: pay.status });
  } catch (e: any) {
    console.error('webhook v1 error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'webhook_failed' }, { status: 500 });
  }
}
