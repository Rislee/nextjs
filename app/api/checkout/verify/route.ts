// app/api/checkout/verify/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getV1AccessToken, getV1Payment } from '@/lib/portone/v1';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = { impUid?: string; merchantUid?: string };

export async function POST(req: Request) {
  try {
    const { impUid, merchantUid }: Body = await req.json();
    if (!impUid) return NextResponse.json({ ok: false, error: 'missing_imp_uid' }, { status: 400 });

    const token = await getV1AccessToken();
    const pay   = await getV1Payment(impUid, token); // { imp_uid, merchant_uid, status, amount, currency, ... }

    if (merchantUid && pay.merchant_uid && merchantUid !== pay.merchant_uid) {
      return NextResponse.json({ ok: false, error: 'merchant_mismatch' }, { status: 400 });
    }
    if (pay.status !== 'paid') {
      return NextResponse.json({ ok: false, status: pay.status, error: 'payment_not_paid' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 1) 업데이트 시도 (merchant_uid 멱등)
    const up = await supabaseAdmin
      .from('payments')
      .update({
        status: 'paid',
        amount_total: pay.amount ?? null,
        currency: pay.currency ?? null,
        portone_payment_id: pay.imp_uid,     // ✅ imp_uid 저장
        failure: null,
        updated_at: now,
      })
      .eq('merchant_uid', pay.merchant_uid)
      .select('id');                         // 업데이트된 행이 있는지 확인

    if (up.error) {
      return NextResponse.json({ ok: false, step: 'payments.update', detail: up.error }, { status: 500 });
    }

    // 2) 업데이트 0행이면 insert로 보정 (테스트/경계 상황 대비)
    if (!up.data || up.data.length === 0) {
      const ins = await supabaseAdmin.from('payments').insert({
        merchant_uid: pay.merchant_uid,
        status: 'paid',
        amount_total: pay.amount ?? null,
        currency: pay.currency ?? null,
        portone_payment_id: pay.imp_uid,
        failure: null,
        created_at: now,
        updated_at: now,
      }).select('id');

      if (ins.error) {
        return NextResponse.json({ ok: false, step: 'payments.insert', detail: ins.error }, { status: 500 });
      }
    }

    // 3) 멤버십 활성화 (payments에 user_id, plan_id가 있으면)
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

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('verify error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'verify_failed' }, { status: 500 });
  }
}
