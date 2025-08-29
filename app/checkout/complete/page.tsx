// app/checkout/complete/page.tsx
"use client";

import { Suspense } from "react";
import CompleteClient from "./CompleteClient";

// 동적 쿼리 의존 → 프리렌더 금지
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense fallback={<div>결제 상태 확인 중…</div>}>
      <CompleteClient />
    </Suspense>
  );
}
