// app/checkout/complete/page.tsx  (✅ 서버 컴포넌트)
import { Suspense } from "react";
import CompleteClient from "./CompleteClient";

// 라우트 세그먼트 설정은 서버 파일에서만!
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense fallback={<div>결제 상태 확인 중…</div>}>
      <CompleteClient />
    </Suspense>
  );
}
