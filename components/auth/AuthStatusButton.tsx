// components/auth/AuthStatusButton.tsx
'use client';

import { useEffect, useState } from 'react';
import LogoutButton from '@/components/auth/LogoutButton';

export default function AuthStatusButton() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    // uid 쿠키 직접 확인하는 함수
    const checkAuthStatus = () => {
      const allCookies = document.cookie;
      console.log('All cookies:', allCookies);
      
      const cookies = document.cookie.split(';');
      const uidCookie = cookies.find(cookie => 
        cookie.trim().startsWith('uid=')
      );
      
      const uidValue = uidCookie ? uidCookie.split('=')[1]?.trim() : null;
      const hasUid = uidValue && uidValue !== '';
      
      console.log('UID cookie found:', uidCookie);
      console.log('UID value:', uidValue);
      console.log('Has valid UID:', hasUid);
      
      setDebugInfo(`UID: ${uidValue ? 'Yes' : 'No'} | Cookies: ${cookies.length}`);
      setLoggedIn(!!hasUid);
    };

    // 초기 확인
    checkAuthStatus();

    // API로도 확인해보기
    const checkWithAPI = async () => {
      try {
        const response = await fetch('/api/me/summary', { credentials: 'include' });
        console.log('API check status:', response.status);
        const isAPILoggedIn = response.status === 200;
        console.log('API says logged in:', isAPILoggedIn);
      } catch (error) {
        console.log('API check failed:', error);
      }
    };

    checkWithAPI();

    // 주기적으로 쿠키 상태 확인 (3초마다로 줄임)
    const interval = setInterval(checkAuthStatus, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // 디버깅용으로 상태 표시
  return (
    <div className="flex items-center gap-2">
      {loggedIn === null ? (
        <div className="rounded border px-3 py-1 text-sm bg-gray-100 text-gray-400">
          확인중...
        </div>
      ) : loggedIn ? (
        <LogoutButton />
      ) : (
        <a href="/auth/sign-in" className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
          로그인
        </a>
      )}
      
      {/* 디버깅 정보 (나중에 제거) */}
      <div className="text-xs text-gray-400" title={debugInfo}>
        {debugInfo}
      </div>
    </div>
  );
}