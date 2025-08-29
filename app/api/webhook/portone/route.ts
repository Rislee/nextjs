// app/api/webhook/portone/route.ts  (V1 전용)
import { NextRequest, NextResponse } from 'next/server';
import { getV1AccessToken, getV1Payment } from '@/lib/portone/v1';
// import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get('content-type') || '';
    let payload: any = {};
    if (ct.includes('application/json')) {
      payload = await req.json();
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      payload = Object.fromEntries(form.entries());
    } else {
      return NextResponse.json({ ok: false, error: 'unsupported_content_type', ct }, { status: 415 });
    }

    const imp_uid = String(payload.imp_uid || '');
    const merchant_uid = String(payload.merchant_uid || '');
    const hookStatus = String(payload.status || '');

    if (!imp_uid) {
      return NextResponse.json({ ok: false, error: 'imp_uid_missing', got: payload }, { status: 400 });
    }

    // 1) V1 토큰 발급
    let token: string;
    try {
      token = await getV1AccessToken();
    } catch (e: any) {
      console.error('getToken failed', e);
      return NextResponse.json({ ok: false, error: 'get_token_failed', detail: e?.message }, { status: 502 });
    }

    // 2) 결제 단건 조회
    let pay: Awaited<ReturnType<typeof getV1Payment>>;
    try {
      pay = await getV1Payment(imp_uid, token);
    } catch (e: any) {
      console.error('getPayment failed', e);
      // 보통 여기서 “payment not found” 류로 많이 납니다.
      return NextResponse.json(
        { ok: false, error: 'get_payment_failed', imp_uid, detail: e?.message },
        { status: 400 },
      );
    }

    // 3) 비즈니스 검증/DB 반영 (예시)
    // if (merchant_uid && pay.merchant_uid && merchant_uid !== pay.merchant_uid) { ... }
    // await supabaseAdmin.from('payments').update(...).eq('merchant_uid', pay.merchant_uid);
    // if (pay.status === 'paid') { memberships 활성화 ... }

    return NextResponse.json({
      ok: true,
      imp_uid: pay.imp_uid,
      merchant_uid: pay.merchant_uid,
      status: pay.status,     // 'paid' | 'ready' | 'failed' | 'cancelled'
      amount: pay.amount,
      from_hook: hookStatus,  // 훅이 말한 status (참고용)
    });
  } catch (e: any) {
    console.error('webhook fatal', e);
    return NextResponse.json({ ok: false, error: 'webhook_failed', detail: e?.message }, { status: 500 });
  }
}
