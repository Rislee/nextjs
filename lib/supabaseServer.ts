// lib/supabaseServer.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Next.js 15에서는 cookies()가 Promise를 반환합니다.
 * 그래서 아래처럼 await cookies()를 사용해야 해요.
 */
export function supabaseServer() {
  const cookieStorePromise = cookies(); // Promise<ReadonlyRequestCookies>

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => {
          const jar = await cookieStorePromise;
          return jar.get(name)?.value;
        },
        set: async (name: string, value: string, options: any) => {
          const jar = await cookieStorePromise;
          jar.set(name, value, options);
        },
        remove: async (name: string, options: any) => {
          const jar = await cookieStorePromise;
          jar.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );
}
