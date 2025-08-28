import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { planId } = await req.json();
    if (!planId) return NextResponse.json({ ok:false, error:'missing planId' }, { status:400 });

    const cookieStore = await cookies();           // 👈 여기 중요
    const uid = cookieStore.get('uid')?.value;     // HttpOnly uid
    if (!uid) return NextResponse.json({ ok:false, error:'unauthorized' }, { status:401 });

    const { data: plan, error: planErr } = await supabaseAdmin
      .from('plans').select('id,name,price,currency').eq('id', planId).maybeSingle();
    if (planErr) return NextResponse.json({ ok:false, error:planErr.message }, { status:500 });
    if (!plan)   return NextResponse.json({ ok:false, error:'invalid plan' }, { status:400 });

    const merchantUid = `inneros_${planId}_${Date.now()}`;
    const { error: insErr } = await supabaseAdmin.from('orders').insert({
      user_id: uid, plan_id: plan.id, merchant_uid: merchantUid,
      amount: plan.price, currency: plan.currency, status:'pending'
    });
    if (insErr) return NextResponse.json({ ok:false, error:insErr.message }, { status:500 });

    return NextResponse.json({
      ok:true, merchantUid, amount: plan.price, currency: plan.currency,
      orderName: `InnerOS ${plan.name}`
    });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e?.message ?? 'unknown' }, { status:500 });
  }
}
