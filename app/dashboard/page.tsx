import { cookies } from "next/headers";
import DashboardClient from "@/components/dashboard/DashboardClient";

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

  return <DashboardClient />;
}
