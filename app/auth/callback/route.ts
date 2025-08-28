// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const supabase = supabaseServer();

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.redirect(new URL("/auth/sign-in?e=nouser", req.url));
    }

    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from("users").insert({ id: user.id, email: user.email ?? null });
    }

    // ✅ uid 쿠키 심기 (Next 15: cookies() async)
    const res = NextResponse.redirect(new URL("/checkout", req.url));
    const jar = await cookies();
    jar.set("uid", user.id, {
  httpOnly: true,
  sameSite: "lax",
  secure: false,         
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
});
    return res;
  } catch (e) {
    return NextResponse.redirect(new URL("/auth/sign-in?e=callback", req.url));
  }
}

