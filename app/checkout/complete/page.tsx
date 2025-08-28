"use client";

import { useSearchParams } from "next/navigation";

export default function CompletePage() {
  const params = useSearchParams();
  const result = params.get("result");
  const merchantUid = params.get("merchant_uid");

  return (
    <main style={{ padding: 24 }}>
      <h1>결제 완료 페이지</h1>
      <p>결과: {result}</p>
      <p>주문번호: {merchantUid}</p>
    </main>
  );
}
