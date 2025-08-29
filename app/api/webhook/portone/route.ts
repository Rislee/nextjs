// app/api/webhook/portone/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getV1AccessToken, getV1Payment } from '@/lib/portone/v1';
// import { supabaseAdmin } from '@/lib/supabaseAdmin'; // DB 반영이 필요하면 사용

export const dynamic = 'force-dynamic'; // Vercel 캐시 방지

export async function POST(req: NextRequest) {
  try {
    // 1) Content-Type 별 파싱 (V1은 JSON 또는 x-www-form-urlencoded 둘 다 가능)
    const ct = req.headers.get('content-type') || '';
    let payload: any = {};
    if (ct.includes('application/json')) {
      payload = await req.json();
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      payload = Object.fromEntries(form.entries());
    } else {
      return NextResponse.json({ ok: false, error: 'unsupported_content_type' }, { status: 415 });
    }

    // 2) V1 웹훅 필드 (imp_uid, merchant_uid, status)
    const imp_uid = String(payload.imp_uid || '');
    const merchant_uid = String(payload.merchant_uid || '');
    const hookStatus = String(payload.status || '');

    if (!imp_uid) {
      return NextResponse.json({ ok: false, error: 'imp_uid_missing' }, { status: 400 });
    }

    // 3) 포트원 V1로 결제건 조회하여 검증
    const token = await getV1AccessToken();
    const pay = await getV1Payment(imp_uid, token);
    // pay.status: 'paid' | 'ready' | 'failed' | 'cancelled'
    // pay.amount: 결제금액(정수)

    // (선택) merchant_uid 일치 여부 확인
    if (merchant_uid && pay.merchant_uid && merchant_uid !== pay.merchant_uid) {
      // 불일치하면 무시 or 로깅
      console.warn('merchant_uid mismatch', { hook: merchant_uid, api: pay.merchant_uid });
    }

    // 4) 여기서 금액/화폐 등 비즈니스 검증
    // ex) DB의 주문금액과 pay.amount 동일한지 확인 등…
    // const { data: order } = await supabaseAdmin.from('orders').select('amount').eq('merchant_uid', pay.merchant_uid).single();
    // if (order?.amount !== pay.amount) { ... }

    // 5) DB 반영 (예시)
    // await supabaseAdmin.from('payments')
    //   .update({
    //     status: pay.status,           // 'paid' | 'failed' | 'cancelled' | 'ready'
    //     amount_total: pay.amount,
    //     currency: pay.currency ?? 'KRW',
    //     portone_payment_id: pay.imp_uid,
    //     updated_at: new Date().toISOString(),
    //   })
    //   .eq('merchant_uid', pay.merchant_uid);

    // if (pay.status === 'paid') {
    //   // memberships 활성화 등 후처리…
    // }

    return NextResponse.json({ ok: true, imp_uid: pay.imp_uid, status: pay.status });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'unknown_error' }, { status: 500 });
  }
}
