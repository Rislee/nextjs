// app/api/webhook/portone/route.ts
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
    let cur: any = value;
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
    const body = await req.json().catch(() => ({}));

    // imp_uid / merchant_uid 추출 (여러 형태 대응) + trim
    const impUid = (pick(body, 'imp_uid', 'data.imp_uid', 'data.id', 'id') ?? '').toString().trim();
    const givenMerchantUid = (pick(
      body,
      'merchant_uid',
      'data.merchant_uid',
      'merchantOrderId',
      'merchant_order_id'
    ) ?? '').toString().trim();

    if (!impUid) {
      return NextResponse.json({ ok: false, error: 'missing_imp_uid' }, { status: 400 });
    }

    // V1 원장 조회로 상태/merchant_uid 신뢰값 확보
    const token = await getV1AccessToken();
    const pay = await getV1Payment(impUid, token); // { imp_uid, merchant_uid, status, amount, currency, fail_reason ... }
    const bookMerchantUid = (pay.merchant_uid ?? '').toString().trim();
    const now = new Date().toISOString();

    // 수동 테스트 등으로 넘어온 merchant_uid와 불일치해도 차단하지 않고 로그만 남김
    if (givenMerchantUid && bookMerchantUid && givenMerchantUid !== bookMerchantUid) {
      console.warn('[webhook] merchant_uid mismatch (ignored)', {
        given: givenMerchantUid,
        book: bookMerchantUid,
      });
    }

    // ── 상태별 처리 ──────────────────────────────────────────────────────────────
    if (pay.status === 'paid') {
      // 1) update (멱등) 후 0행이면 insert 보정
      const up = await supabaseAdmin
        .from('payments')
        .update({
          status: 'paid',
          amount_total: pay.amount ?? null,
          currency: pay.currency ?? null,
          portone_payment_id: pay.imp_uid, // ✅ imp_uid 저장
          failure: null,
          updated_at: now,
        })
        .eq('merchant_uid', bookMerchantUid)
        .select('id');

      if (up.error) {
        return NextResponse.json({ ok: false, step: 'payments.update', detail: up.error }, { status: 500 });
      }

      if (!up.data || up.data.length === 0) {
        const ins = await supabaseAdmin
          .from('payments')
          .insert({
            merchant_uid: bookMerchantUid,
            status: 'paid',
            amount_total: pay.amount ?? null,
            currency: pay.currency ?? null,
            portone_payment_id: pay.imp_uid,
            failure: null,
            created_at: now,
            updated_at: now,
          })
          .select('id');

        if (ins.error) {
          return NextResponse.json({ ok: false, step: 'payments.insert', detail: ins.error }, { status: 500 });
        }
      }

      // 2) memberships 활성화 (payments에 user_id, plan_id가 있으면)
      const q = await supabaseAdmin
        .from('payments')
        .select('user_id, plan_id')
        .eq('merchant_uid', bookMerchantUid)
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
        .eq('merchant_uid', bookMerchantUid);

      if (up.error) {
        return NextResponse.json({ ok: false, step: 'payments.update', detail: up.error }, { status: 500 });
      }
      return NextResponse.json({ ok: true, status: pay.status });
    }

    // ready 등 기타 상태는 200
    return NextResponse.json({ ok: true, status: pay.status });
  } catch (e: any) {
    console.error('webhook v1 error', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'webhook_failed' }, { status: 500 });
  }
}
