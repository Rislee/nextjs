import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-internal-key");
  if (key !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ ok:false, error:"forbidden" }, { status: 403 });
  }

  const { email, planId, status } = await req.json();
  if (!email || !planId) {
    return NextResponse.json({ ok:false, error:"missing_params" }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { error } = await admin.rpc("admin_grant_membership", {
    p_email: email, p_plan: planId, p_status: status || "active"
  });

  if (error) {
    return NextResponse.json({ ok:false, error:error.message }, { status: 500 });
  }
  return NextResponse.json({ ok:true });
}
