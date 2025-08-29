import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Plan = 'FREE' | 'START_OS' | 'SIGNATURE_OS' | 'MASTER_OS';
type Status = 'active' | 'past_due' | 'canceled' | 'none';

function toPlan(val: any): Plan {
  const v = String(val || '').toUpperCase();
  return (v === 'START_OS' || v === 'SIGNATURE_OS' || v === 'MASTER_OS') ? (v as Plan) : 'FREE';
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const forcedUid = url.searchParams.get('userId') || '';

    const hdrKey = req.headers.get('x-internal-key') || '';
    const envKey = process.env.INTERNAL_API_KEY || '';
    if (hdrKey && envKey && hdrKey !== envKey) {
      return NextResponse.json({ plan: 'FREE', status: 'none', detail: 'forbidden' }, { status: 403 });
    }

    let userId = forcedUid;
    if (!userId) {
      const jar = await cookies();
      userId = jar.get('uid')?.value || '';
    }
    if (!userId) {
      return NextResponse.json({ plan: 'FREE', status: 'none', detail: 'no_user' }, { status: 200 });
    }

    const m = await supabaseAdmin
      .from('memberships')
      .select('plan_id, status, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (m.error) {
      return NextResponse.json({ plan: 'FREE', status: 'none', detail: 'db_error' }, { status: 200 });
    }

    const plan = toPlan(m.data?.plan_id);
    const status: Status = (m.data?.status as Status) || 'none';

    return NextResponse.json({ plan, status }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ plan: 'FREE', status: 'none', detail: 'internal_error' }, { status: 200 });
  }
}
