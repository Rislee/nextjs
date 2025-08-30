import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ck = await cookies();
  const uid = ck.get("uid")?.value || "";

  if (!uid) {
    // 미들웨어에서도 막지만, 서버 가드 한 번 더
    return (
      <main className="p-6">
        <p className="text-sm">로그인이 필요합니다.</p>
      </main>
    );
  }

  // 사용자 이메일 가져오기 (관리자 확인용)
  let userEmail = "";
  let isAdmin = false;
  
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => ck.get(name)?.value,
          set() {},
          remove() {},
        },
      }
    );
    
    const { data } = await supabase.auth.getUser();
    userEmail = data.user?.email || "";
    isAdmin = isAdminEmail(userEmail);
  } catch (error) {
    console.error("Error fetching user:", error);
  }

  return <DashboardClient isAdmin={isAdmin} userEmail={userEmail} />;
}