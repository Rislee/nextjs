// app/api/checkout/verify/route.ts
import { NextResponse } from 'next/server';
import { getPaymentById } from '@/lib/portone';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Body = {
  paymentId?: string;   // 포트원 결제 ID (우선)
  impUid?: string;      // 호환 필드
  merchantUid?: string; // 우리 상점 주문번호(선택)
};

export async function POST(req: Request) {
  try {
    const { paymentId, impUid, merchantUid }: Body = await req.json();

    const pid = paymentId || impUid;
    if (!pid && !merchantUid) {
      return NextResponse.json({ ok: false, error: 'missing_ids' }, { status: 400 });
    }

    // 1) 포트원 진위 확인 (pid가 있으면 원격 조회)
    let pay:
      | (Awaited<ReturnType<typeof getPaymentById>> & { merchant_uid?: string })
      | null = null;

    if (pid) {
      pay = await getPaymentById(pid);
    }

    // 2) 우리 DB payments 찾기 기준(merchant_uid가 주 기준)
    //    - merchantUid 파라미터가 있으면 그걸 우선
    //    - 없으면 포트원 응답에서 유추(응답 필드 차이가 있으므로 느슨하게)
    const mUidGuess =
      merchantUid ||
      // v1 응답에 따라 orderName/merchantId로 못 얻는 경우가 있어 미리 저장한 merchant_uid로 매칭
      undefined;

    if (!mUidGuess) {
      // 프론트에서 항상 merchantUid를 같이 보내도록 권장
      // 없더라도 pid로 DB 내 pending 건을 찾아 매칭 시도 가능(옵션)
    }

    // 3) 결제 상태 해석
    const status = (pay?.status || '').toUpperCase();
    if (status && status !== 'PAID') {
      return NextResponse.json(
        {
          ok: false,
          status,
          error: 'payment_not_paid',
        },
        { status: 400 },
      );
    }

    // 4) DB 반영: payments → paid
    //    - merchant_uid로 업데이트 (없으면 pid 기반 fallback)
    const nowIso = new Date().toISOString();

    if (mUidGuess) {
      const up1 = await supabaseAdmin
        .from('payments')
        .update({
          status: 'paid',
          updated_at: nowIso,
        })
        .eq('merchant_uid', mUidGuess);

      if (up1.error) {
        return NextResponse.json(
          { ok: false, step: 'payments.update', error: 'update_failed', detail: up1.error },
          { status: 500 },
        );
      }
    }

    // 5) 멤버십 활성화 (payments 테이블에서 user_id/plan_id를 가져와 upsert)
    if (mUidGuess) {
      const q = await supabaseAdmin
        .from('payments')
        .select('user_id, plan_id')
        .eq('merchant_uid', mUidGuess)
        .maybeSingle();

      if (!q.error && q.data?.user_id && q.data?.plan_id) {
        const up2 = await supabaseAdmin
          .from('memberships')
          .upsert(
            {
              user_id: q.data.user_id,
              plan_id: q.data.plan_id,
              status: 'active',
              updated_at: nowIso,
            },
            { onConflict: 'user_id' },
          );
        if (up2.error) {
          return NextResponse.json(
            { ok: false, step: 'memberships.upsert', error: 'upsert_failed', detail: up2.error },
            { status: 500 },
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('verify error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'verify_failed' }, { status: 500 });
  }
}
