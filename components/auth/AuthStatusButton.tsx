// components/auth/AuthStatusButton.tsx
'use client';

import { useEffect, useState } from 'react';
import LogoutButton from '@/components/auth/LogoutButton';

export default function AuthStatusButton() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    // uid 쿠키 직접 확인하는 함수
    const checkAuthStatus = () => {
      const cookies = document.cookie.split(';');
      const uidCookie = cookies.find(cookie => 
        cookie.trim().startsWith('uid=')
      );
      
      const hasUid = uidCookie && uidCookie.split('=')[1]?.trim();
      setLoggedIn(!!hasUid);
    };

    // 초기 확인
    checkAuthStatus();

    // 주기적으로 쿠키 상태 확인 (1초마다)
    const interval = setInterval(checkAuthStatus, 1000);

    // 스토리지 이벤트 리스너 (다른 탭에서 로그인/로그아웃 시)
    const handleStorageChange = () => {
      setTimeout(checkAuthStatus, 100);
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // 포커스 이벤트 리스너 (탭 전환 시 상태 재확인)
    window.addEventListener('focus', checkAuthStatus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', checkAuthStatus);
    };
  }, []);

  // 상태가 확인되지 않았으면 아무것도 표시하지 않음
  if (loggedIn === null) {
    return null;
  }

  return loggedIn ? (
    <LogoutButton />
  ) : (
    <a href="/auth/sign-in" className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
      로그인
    </a>
  );
}