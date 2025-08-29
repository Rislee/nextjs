import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getV1Token() {
  const key = process.env.PORTONE_V1_API_KEY!;
  const secret = process.env.PORTONE_V1_API_SECRET!;
  const r = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ imp_key: key, imp_secret: secret }),
    cache: 'no-store'
  });
  const j = await r.json();
  return j?.response?.access_token as string | undefined;
}

export async function POST(req: Request) {
  // 표준 웹훅: body에 imp_uid/merchant_uid 등이 옴 (V1)
  const body = await req.json().catch(() => ({}));
  const impUid = body?.imp_uid || body?.data?.imp_uid;
  const merchantUid = body?.merchant_uid || body?.data?.merchant_uid;

  if (!impUid && !merchantUid) {
    return NextResponse.json({ ok:false, error:'missing_params' }, { status:400 });
  }

  const token = await getV1Token();
  if (!token) return NextResponse.json({ ok:false, error:'v1_token_failed' }, { status:400 });

  let mu = merchantUid as string | undefined;

  if (impUid) {
    const payR = await fetch(`https://api.iamport.kr/payments/${impUid}`, {
      headers: { Authorization: token },
      cache: 'no-store'
    });
    if (!payR.ok) return NextResponse.json({ ok:false, error:`v1_getPayment ${payR.status}` }, { status:400 });
    const pay = (await payR.json())?.response;
    if (!pay) return NextResponse.json({ ok:false, error:'no_payment' }, { status:400 });
    mu = mu ?? pay.merchant_uid;
  }

  if (!mu) return NextResponse.json({ ok:false, error:'merchant_not_found' }, { status:400 });

  // 최소 반영(상태/금액/통화) — 필요한 컬럼만 안전하게
  const sel = await supabaseAdmin.from('payments').select('*').eq('merchant_uid', mu).maybeSingle();
  if (sel.error || !sel.data) return NextResponse.json({ ok:false, error:'payment_not_found' }, { status:404 });

  const row = sel.data as Record<string, any>;
  const upd: Record<string, any> = {};
  const status = (body?.status || body?.data?.status || '').toLowerCase();
  if ('status' in row) {
    if (status === 'paid') upd.status = 'paid';
    else if (status) upd.status = status;
  }
  if ('amount' in row && body?.data?.amount?.total) upd.amount = Number(body.data.amount.total);
  if ('currency' in row && body?.data?.currency) upd.currency = String(body.data.currency);
  if ('updated_at' in row) upd.updated_at = new Date().toISOString();

  if (Object.keys(upd).length) {
    const up = await supabaseAdmin.from('payments').update(upd).eq('merchant_uid', mu);
    if (up.error) return NextResponse.json({ ok:false, error:'payments.update_failed', detail: up.error }, { status:500 });
  }

  return NextResponse.json({ ok:true });
}
