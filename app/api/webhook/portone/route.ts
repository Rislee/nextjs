// app/api/webhook/portone/route.ts  (V1/헥토)
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getV1AccessToken, getV1Payment } from '@/lib/portone/v1';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function pick(value: any, ...paths: string[]): string | undefined {
  for (const p of paths) {
    const seg = p.split('.');
    let cur = value;
    let ok = true;
    for (const s of seg) {
      if (cur && typeof cur === 'object' && s in cur) cur = (cur as any)[s];
      else { ok = false; break; }
    }
    if (ok && (typeof cur === 'string' || typeof cur === 'number')) return String(cur);
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const impUid = pick(body, 'imp_uid', 'data.imp_uid', 'data.id', 'id');
    const merchantUid = pick(body, 'merchant_uid', 'data.merchant_uid');
    if (!impUid) return NextResponse.json({ ok: false, error: 'missing_imp_uid' }, { status: 400 });

    const token = await getV1AccessToken();
    const pay   = await getV1Payment(impUid, token);

    if (merchantUid && pay.merchant_uid && merchantUid !== pay.merchant_uid) {
      return NextResponse.json({ ok: false, error: 'merchant_mismatch' }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (pay.status === 'paid') {
      const up = await supabaseAdmin
        .from('payments')
        .update({
          status: 'paid',
          amount_total: pay.amount ?? null,
          currency: pay.currency ?? null,
          portone_payment_id: pay.imp_uid,
          failure: null,
          updated_at: now,
        })
        .eq('merchant_uid', pay.merchant_uid)
        .select('id');

      if (up.error) return NextResponse.json({ ok: false, step: 'payments.update', detail: up.error }, { status: 500 });

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
        if (ins.error) return NextResponse.json({ ok: false, step: 'payments.insert', detail: ins.error }, { status: 500 });
      }

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

    // 실패/취소 반영
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

    return NextResponse.json({ ok: true, status: pay.status });
  } catch (e: any) {
    console.error('webhook v1 error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'webhook_failed' }, { status: 500 });
  }
}
