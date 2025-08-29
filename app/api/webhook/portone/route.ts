import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getV1AccessToken, getV1Payment } from '@/lib/portone/v1';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** 안전하게 중첩 경로에서 값 뽑기 */
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
    // 1) 바디 파싱 (v1은 포맷 제각각이라 폭넓게 대응)
    const body = await req.json().catch(() => ({} as any));
    const impUid = pick(body, 'imp_uid', 'data.imp_uid', 'id', 'data.id');
    const merchantUid = pick(
      body,
      'merchant_uid',
      'data.merchant_uid',
      'merchant_order_id',
      'merchantOrderId'
    );

    if (!impUid) {
      // imp_uid가 없으면 검증 불가
      return NextResponse.json({ ok: false, error: 'missing_imp_uid' }, { status: 400 });
    }

    // 2) v1 결제 조회
    const token = await getV1AccessToken();
    const pay = await getV1Payment(impUid, token);
    // pay: { imp_uid, merchant_uid, status: 'paid'|'failed'|'cancelled'|'ready'..., amount, currency, fail_reason? }

    // (선택) merchant_uid 교차검증: 있으면 동일해야 함
    if (merchantUid && pay.merchant_uid && merchantUid !== pay.merchant_uid) {
      // 포맷/매칭 문제는 400으로 알려줌
      return NextResponse.json({ ok: false, error: 'merchant_mismatch' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 3) 상태별 처리
    if (pay.status === 'paid') {
      // payments 갱신
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

      if (up1.error) {
        return NextResponse.json(
          { ok: false, step: 'payments.update', detail: up1.error },
          { status: 500 }
        );
      }

      // memberships 활성화 (user_id, plan_id를 payments에서 가져옴)
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
            { onConflict: 'user_id' }
          );
        if (up2.error) {
          return NextResponse.json(
            { ok: false, step: 'memberships.upsert', detail: up2.error },
            { status: 500 }
          );
        }
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

      if (up.error) {
        return NextResponse.json(
          { ok: false, step: 'payments.update', detail: up.error },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, status: pay.status });
    }

    // ready 등 기타 상태는 200으로 처리
    return NextResponse.json({ ok: true, status: pay.status });
  } catch (e: any) {
    console.error('webhook v1 error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'webhook_failed' }, { status: 500 });
  }
}
