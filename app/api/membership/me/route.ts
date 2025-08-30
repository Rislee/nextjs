// app/api/membership/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const ALLOW_ORIGIN = [
  "https://www.inneros.co.kr",
  "https://inneros.framer.website",
];

function cors(origin: string) {
  const allow = ALLOW_ORIGIN.find(o => origin.startsWith(o)) ?? ALLOW_ORIGIN[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: cors(req.headers.get("origin") ?? "") });
}

export async function GET(req: NextRequest) {
  const headers = cors(req.headers.get("origin") ?? "");
  try {
    const ck = await cookies();
    const uid = ck.get("uid")?.value;
    if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers });

    const m = await supabaseAdmin
      .from("memberships")
      .select("plan_id,status,updated_at")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (m.error) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500, headers });
    return NextResponse.json({ ok: true, data: m.data ?? null }, { status: 200, headers });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown" }, { status: 500, headers });
  }
}
