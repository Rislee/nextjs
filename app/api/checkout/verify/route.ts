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
    const pay = await getV1Payment(impUid, token);

    if (merchantUid && pay.merchant_uid !== merchantUid) {
      return NextResponse.json({ ok: false, error: 'merchant_mismatch' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // payments 업데이트 (없는 경우 대비 upsert 유사 로직)
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
      .select('id, user_id, plan_id')
      .maybeSingle();

    let userId: string | null = null;
    let planId: string | null = null;

    if (up.data) {
      userId = (up.data as any).user_id || null;
      planId = (up.data as any).plan_id || null;
    } else {
      // 행이 없다면 삽입 (웹훅 선행 등 경계 상황 보정)
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
        .select('id, user_id, plan_id')
        .maybeSingle();
      if (!ins.error) {
        userId = (ins.data as any)?.user_id || null;
        planId = (ins.data as any)?.plan_id || null;
      }
    }

    // 결제가 'paid'일 때 멤버십 활성화 (userId/planId가 있는 경우에만)
    if (pay.status === 'paid') {
      if (!userId || !planId) {
        // payments에서 user/plan 정보 조회
        const q = await supabaseAdmin
          .from('payments')
          .select('user_id, plan_id')
          .eq('merchant_uid', pay.merchant_uid)
          .maybeSingle();
        if (q.data) {
          userId = q.data.user_id as string | null;
          planId = q.data.plan_id as string | null;
        }
      }
      if (userId && planId) {
        await supabaseAdmin
          .from('memberships')
          .upsert(
            { user_id: userId, plan_id: planId, status: 'active', updated_at: now },
            { onConflict: 'user_id' },
          );
      }
    }

    return NextResponse.json({ ok: true, status: pay.status });
  } catch (e: any) {
    console.error('verify error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'verify_failed' }, { status: 500 });
  }
}
