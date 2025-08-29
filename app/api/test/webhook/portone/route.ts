export const dynamic = "force-dynamic";
export async function GET() {
  return new Response(JSON.stringify({ ok: true, method: "GET" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
export async function POST(req: Request) {
  const key = req.headers.get("x-internal-key") || "";
  if (key !== (process.env.INTERNAL_API_KEY ?? "")) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const body = await req.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: true, received: body }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
