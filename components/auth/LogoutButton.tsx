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

  const triggerAuthChange = () => {
    // AuthStatusButton에게 상태 변화 알리기
    try {
      window.dispatchEvent(new CustomEvent('auth-status-changed'));
      localStorage.setItem('auth_changed', Date.now().toString());
      localStorage.removeItem('auth_changed');
    } catch (e) {
      // 무시
    }
  };

  async function onLogout() {
    if (loading) return;
    setLoading(true);
    
    try {
      console.log('=== Starting logout process ===');
      
      // 1) Supabase 세션 로그아웃 (타임아웃 처리)
      try {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 3000)
          ),
        ]);
        console.log('Supabase signOut completed');
      } catch (e) {
        console.log('Supabase signOut timeout/error, continuing...', e);
      }

      // 2) 서버 uid 쿠키 제거
      try {
        const logoutRes = await fetch('/api/auth/logout', { 
          method: 'POST', 
          credentials: 'include' 
        });
        console.log('Logout API response:', logoutRes.status);
      } catch (e) {
        console.log('Logout API error, continuing...', e);
      }

      // 3) 클라이언트에서도 쿠키 확인 및 정리
      const cookies = document.cookie.split(';');
      console.log('Current cookies before logout:', cookies.length);
      
      // 상태 변화 알리기
      triggerAuthChange();
      
      // 4) 약간의 지연 후 강제 이동
      setTimeout(() => {
        console.log('Redirecting to sign-in...');
        window.location.href = '/auth/sign-in';
      }, 500); // 0.5초 지연으로 상태 업데이트 시간 확보
      
    } catch (error) {
      console.error('Logout error:', error);
      // 에러가 발생해도 로그인 페이지로 이동
      triggerAuthChange();
      setTimeout(() => {
        window.location.href = '/auth/sign-in';
      }, 500);
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