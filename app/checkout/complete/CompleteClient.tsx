// app/checkout/complete/page.tsx
import { Suspense } from 'react';
import CompleteClient from './CompleteClient';

// 이 페이지는 쿼리 기반 동적 페이지 → 프리렌더 금지
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense fallback={<div>결제 상태 확인 중…</div>}>
      <CompleteClient />
    </Suspense>
  );
}
