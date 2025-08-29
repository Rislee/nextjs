import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getV1AccessToken, getV1Payment } from '@/lib/portone/v1';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// 포트원 V1 webhook payload는 케이스가 다양할 수 있어 폭넓게 파싱
function pick(value: any, ...paths: string[]): string | undefined {
  for (const p of paths) {
    const seg = p.split('.');
    let cur = value;
    let ok = true;
    for (const s of seg) {
      if (cur && typeof cur === 'object' && s in cur) cur = cur[s];
      else { ok = false; break; }
    }
    if (ok && (typeof cur === 'string' || typeof cur === 'number')) return String(cur);
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // imp_uid / merchant_uid 추출 (여러 형태 대응)
    const impUid = pick(body, 'imp_uid', 'data.imp_uid', 'data.id', 'id');
    const merchantUid = pick(body,
      'merchant_uid', 'data.merchant_uid', 'merchantOrderId', 'merchant_order_id', 'merchant_uid');

    if (!impUid) {
      return NextResponse.json({ ok: false, error: 'missing_imp_uid' }, { status: 400 });
    }

    // V1 조회로 상태 확인
    const token = await getV1AccessToken();
    const pay = await getV1Payment(impUid, token);

    if (merchantUid && pay.merchant_uid && merchantUid !== pay.merchant_uid) {
      return NextResponse.json({ ok: false, error: 'merchant_mismatch' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 상태별 처리
    if (pay.status === 'paid') {
      const up1 = await supabaseAdmin
        .from('payments')
        .update({
          status: 'paid',
          amount_total: pay.amount ?? null,
          currency: pay.currency ?? null,
          portone_payment_id: pay.imp_uid,
          failure: null,
          updated_at: now,
        })
        .eq('merchant_uid', pay.merchant_uid);

      if (up1.error) return NextResponse.json({ ok: false, step: 'payments.update', detail: up1.error }, { status: 500 });

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
        if (up2.error) return NextResponse.json({ ok: false, step: 'memberships.upsert', detail: up2.error }, { status: 500 });
      }
      return NextResponse.json({ ok: true, status: 'paid' });
    }

    if (pay.status === 'failed' || pay.status === 'cancelled') {
      const up = await supabaseAdmin
        .from('payments')
        .update({
          status: pay.status,
          failure: pay.fail_reason ? { reason: pay.fail_reason } : null,
          updated_at: now,
        })
        .eq('merchant_uid', pay.merchant_uid);
      if (up.error) return NextResponse.json({ ok: false, step: 'payments.update', detail: up.error }, { status: 500 });
      return NextResponse.json({ ok: true, status: pay.status });
    }

    // ready 등은 일단 200
    return NextResponse.json({ ok: true, status: pay.status });
  } catch (e: any) {
    console.error('webhook v1 error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'webhook_failed' }, { status: 500 });
  }
}
