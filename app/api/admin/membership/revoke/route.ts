import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getInternalKey(req: NextRequest) {
  const h = req.headers;
  const x = h.get("x-internal-key")?.trim();
  const bearer = h.get("authorization")?.trim();
  const fromBearer = bearer?.toLowerCase().startsWith("bearer ")
    ? bearer.slice(7).trim()
    : "";
  return x || fromBearer || "";
}

export async function POST(req: NextRequest) {
  const provided = getInternalKey(req);
  const expected = process.env.INTERNAL_API_KEY || "";

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "server_internal_key_not_set" },
      { status: 500 }
    );
  }
  if (!provided || provided !== expected) {
    return NextResponse.json(
      { ok: false, error: "forbidden_invalid_internal_key" },
      { status: 403 }
    );
  }

  const { email, status } = await req.json();
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "missing_email" },
      { status: 400 }
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { error } = await admin.rpc("admin_revoke_membership", {
    p_email: email,
    p_status: status || "canceled",
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
