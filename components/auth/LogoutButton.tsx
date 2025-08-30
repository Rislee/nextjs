'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  async function onLogout() {
    try {
      // 1) Supabase 세션 로그아웃
      await supabase.auth.signOut();
      // 2) 서버 uid 쿠키 제거
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      router.replace('/auth/sign-in');
    }
  }

  return (
    <button onClick={onLogout} className={className ?? "rounded border px-3 py-1 text-sm hover:bg-gray-50"}>
      로그아웃
    </button>
  );
}
