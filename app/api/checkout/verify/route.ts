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

    // 1) PortOne v1 결제 조회
    const token = await getV1AccessToken();
    const pay = await getV1Payment(impUid, token);

    // merchant_uid 불일치 시도는 기록하고 에러 처리
    if (merchantUid && pay.merchant_uid && merchantUid !== pay.merchant_uid) {
      return NextResponse.json({ ok: false, error: 'merchant_mismatch' }, { status: 400 });
    }

    // 2) DB의 대상 주문 찾기
    const q = await supabaseAdmin
      .from('payments')
      .select('id, user_id, plan_id, status')
      .eq('merchant_uid', pay.merchant_uid)
      .maybeSingle();

    if (q.error || !q.data) {
      return NextResponse.json({ ok: false, step: 'payments.select', detail: q.error || 'not_found' }, { status: 404 });
    }

    // 실패/취소는 실패로 반영
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

      return NextResponse.json({ ok: false, status: pay.status, failure: { reason: pay.fail_reason || null } });
    }

    // 아직 ready(결제전)면 대기
    if (pay.status !== 'paid') {
      return NextResponse.json({ ok: false, status: pay.status });
    }

    // 3) paid → payments 업데이트
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

    // 4) user_plans에 플랜 추가/활성화 (UPSERT)
    const now = new Date().toISOString();
    const up2 = await supabaseAdmin
      .from('user_plans')
      .upsert(
        { 
          user_id: q.data.user_id, 
          plan_id: q.data.plan_id, 
          status: 'active', 
          activated_at: now,
          updated_at: now 
        },
        { onConflict: 'user_id,plan_id' } // 사용자+플랜 조합으로 UPSERT
      );
      
    if (up2.error) {
      return NextResponse.json({ ok: false, step: 'user_plans.upsert', detail: up2.error }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      status: 'paid', 
      amount: pay.amount ?? null, 
      currency: pay.currency ?? 'KRW',
      plan_activated: q.data.plan_id
    });
  } catch (e: any) {
    console.error('verify error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'verify_failed' }, { status: 500 });
  }
}