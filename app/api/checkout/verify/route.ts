import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPayment } from '@/lib/portone/server'; // 앞서 만든 server.ts

export async function POST(req: NextRequest) {
  try {
    const { paymentId } = await req.json();
    if (!paymentId) return NextResponse.json({ ok:false, error:'missing paymentId' }, { status:400 });

    const pay = await getPayment(paymentId);
    // 예: 상태/금액 검증
    if (pay.status !== 'PAID') return NextResponse.json({ ok:false, error:`status ${pay.status}` }, { status:400 });

    // 주문 조회
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id,user_id,plan_id,amount,currency,status')
      .eq('merchant_uid', paymentId)
      .maybeSingle();

    if (!order) return NextResponse.json({ ok:false, error:'order not found' }, { status:404 });
    if (order.amount !== pay.amount || order.currency !== pay.currency)
      return NextResponse.json({ ok:false, error:'amount/currency mismatch' }, { status:400 });

    // 주문 결제완료
    await supabaseAdmin.from('orders')
      .update({ status:'paid' })
      .eq('id', order.id);

    // 멤버십 활성화
    await supabaseAdmin.from('memberships')
      .upsert({
        user_id: order.user_id,
        plan: order.plan_id,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    return NextResponse.json({ ok:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e?.message ?? 'unknown' }, { status:500 });
  }
}
