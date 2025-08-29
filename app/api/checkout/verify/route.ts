import { NextResponse } from 'next/server';
import { getV1AccessToken, getV1Payment } from '@/lib/portone/v1';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = { impUid?: string; merchantUid?: string };

export async function POST(req: Request) {
  try {
    const { impUid, merchantUid }: Body = await req.json();
    if (!impUid) {
      return NextResponse.json({ ok: false, error: 'missing_imp_uid' }, { status: 400 });
    }

    const token = await getV1AccessToken();
    const pay = await getV1Payment(impUid, token);

    if (merchantUid && pay.merchant_uid && pay.merchant_uid !== merchantUid) {
      return NextResponse.json({ ok: false, error: 'merchant_mismatch' }, { status: 400 });
    }
    if (pay.status !== 'paid') {
      return NextResponse.json({ ok: false, status: pay.status, error: 'payment_not_paid' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // payments 업데이트 (merchant_uid 기준 멱등)
    if (pay.merchant_uid) {
      const up1 = await supabaseAdmin
        .from('payments')
        .update({
          status: 'paid',
          amount_total: pay.amount ?? null,
          currency: pay.currency ?? null,
          portone_payment_id: pay.imp_uid,        // ✅ V1 imp_uid 저장
          failure: null,
          updated_at: now,
        })
        .eq('merchant_uid', pay.merchant_uid);

      if (up1.error) {
        return NextResponse.json({ ok: false, step: 'payments.update', detail: up1.error }, { status: 500 });
      }

      // user_id / plan_id 조회 → memberships 활성화
      const q = await supabaseAdmin
        .from('payments')
        .select('user_id, plan_id')
        .eq('merchant_uid', pay.merchant_uid)
        .maybeSingle();

      if (!q.error && q.data?.user_id && q.data?.plan_id) {
        const up2 = await supabaseAdmin
          .from('memberships')
          .upsert(
            { user_id: q.data.user_id, plan_id: q.data.plan_id, status: 'active', updated_at: now },
            { onConflict: 'user_id' },
          );
        if (up2.error) {
          return NextResponse.json({ ok: false, step: 'memberships.upsert', detail: up2.error }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('verify error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'verify_failed' }, { status: 500 });
  }
}
