// app/api/checkout/verify/route.ts
import { NextResponse } from 'next/server';
import { getV1AccessToken, getV1Payment } from '@/lib/portone/v1';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = {
  impUid?: string;        // ✅ V1: imp_uid 사용
  merchantUid?: string;   // 우리 주문번호(있으면 정합성↑)
};

export async function POST(req: Request) {
  try {
    const { impUid, merchantUid }: Body = await req.json();
    if (!impUid) {
      return NextResponse.json({ ok: false, error: 'missing_imp_uid' }, { status: 400 });
    }

    // 1) V1 토큰 발급 → 결제 단건 조회
    const token = await getV1AccessToken();
    const pay = await getV1Payment(impUid, token); // pay.status: 'paid' | 'ready' | 'failed' | 'cancelled'

    // (선택) merchant_uid 일치 확인
    if (merchantUid && pay.merchant_uid && pay.merchant_uid !== merchantUid) {
      return NextResponse.json({ ok: false, error: 'merchant_mismatch' }, { status: 400 });
    }

    if (pay.status !== 'paid') {
      return NextResponse.json({ ok: false, status: pay.status, error: 'payment_not_paid' }, { status: 400 });
    }

    // 2) DB 반영(멱등)
    const now = new Date().toISOString();
    if (pay.merchant_uid) {
      const up1 = await supabaseAdmin
        .from('payments')
        .update({ status: 'paid', updated_at: now, portone_payment_id: pay.imp_uid })
        .eq('merchant_uid', pay.merchant_uid);
      if (up1.error) {
        return NextResponse.json({ ok: false, step: 'payments.update', detail: up1.error }, { status: 500 });
      }

      // 결제건의 user_id/plan_id로 멤버십 활성화
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
