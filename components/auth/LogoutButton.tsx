// components/auth/LogoutButton.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  async function onLogout() {
    if (loading) return;
    setLoading(true);
    
    try {
      // 1) Supabase 세션 로그아웃 (최대 2초 대기 후 계속 진행)
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]).catch(() => {
        console.log('Supabase signOut timeout or error, continuing...');
      });

      // 2) 서버 uid 쿠키 제거
      await fetch('/api/auth/logout', { 
        method: 'POST', 
        credentials: 'include' 
      }).catch(() => {
        console.log('Logout API error, continuing...');
      });

      // 3) 강제 이동 (window.location 사용하여 확실히 이동)
      window.location.href = '/auth/sign-in';
      
    } catch (error) {
      console.error('Logout error:', error);
      // 에러가 발생해도 로그인 페이지로 이동
      window.location.href = '/auth/sign-in';
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className={className ?? "rounded border px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"}
    >
      {loading ? '로그아웃 중...' : '로그아웃'}
    </button>
  );
}