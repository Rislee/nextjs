// app/api/membership/me/route.ts (OPTIONS만 교체)
import { NextRequest } from "next/server";

const ALLOW_ORIGIN = [
  "https://www.inneros.co.kr",
  "https://inneros.framer.website",
];

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOW_ORIGIN.find(o => origin.startsWith(o)) ?? ALLOW_ORIGIN[0];

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allow, // 단일 오리진 echo
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}
