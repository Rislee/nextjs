import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
  const { impUid, merchantUid } = await req.json().catch(() => ({}));
  if (!impUid || !merchantUid) {
    return NextResponse.json({ ok:false, error:'missing_params' }, { status:400 });
  }

  const token = await getV1Token();
  if (!token) return NextResponse.json({ ok:false, error:'v1_token_failed' }, { status:400 });

  const payR = await fetch(`https://api.iamport.kr/payments/${impUid}`, {
    headers: { Authorization: token },
    cache: 'no-store'
  });
  if (!payR.ok) {
    return NextResponse.json({ ok:false, error:`v1_getPayment ${payR.status}` }, { status:400 });
  }
  const pay = (await payR.json())?.response;

  if (!pay || pay.merchant_uid !== merchantUid) {
    return NextResponse.json({ ok:false, error:'merchant_mismatch' }, { status:400 });
  }
  if (pay.status !== 'paid') {
    return NextResponse.json({ ok:false, error:'payment_failed', status: pay.status }, { status:400 });
  }

  // DB 반영 (존재 컬럼만 안전하게)
  const sel = await supabaseAdmin.from('payments').select('*').eq('merchant_uid', merchantUid).maybeSingle();
  if (sel.error || !sel.data) return NextResponse.json({ ok:false, error:'payment_not_found' }, { status:404 });
  const row = sel.data as Record<string, any>;
  const upd: Record<string, any> = {};
  if ('status' in row) upd.status = 'paid';
  if ('amount' in row && typeof pay.amount === 'number') upd.amount = pay.amount;
  if ('currency' in row && pay.currency) upd.currency = pay.currency;
  if ('updated_at' in row) upd.updated_at = new Date().toISOString();

  if (Object.keys(upd).length) {
    const up = await supabaseAdmin.from('payments').update(upd).eq('merchant_uid', merchantUid);
    if (up.error) return NextResponse.json({ ok:false, error:'payments.update_failed', detail: up.error }, { status:500 });
  }

  // 멤버십 활성화
  const { user_id, plan_id } = row;
  if (user_id && plan_id) {
    const u = await supabaseAdmin
      .from('memberships')
      .update({ status:'active', plan_id, updated_at: new Date().toISOString() })
      .eq('user_id', user_id);
    if (u.error) return NextResponse.json({ ok:false, error:'memberships.update_failed', detail: u.error }, { status:500 });
  }

  return NextResponse.json({ ok:true, via:'v1', impUid, merchantUid });
}
