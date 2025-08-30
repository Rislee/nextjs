// components/auth/AuthStatusButton.tsx
'use client';

import { useEffect, useState } from 'react';
import LogoutButton from '@/components/auth/LogoutButton';

export default function AuthStatusButton() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    // uid 쿠키 확인하는 함수 (더 안전한 방식)
    const checkAuthStatus = async () => {
      try {
        // 1. 쿠키에서 uid 확인
        const cookies = document.cookie.split(';').map(c => c.trim());
        const uidCookie = cookies.find(cookie => cookie.startsWith('uid='));
        const uidValue = uidCookie ? uidCookie.split('=')[1] : null;
        
        console.log('=== Auth Status Check ===');
        console.log('All cookies:', document.cookie);
        console.log('UID cookie:', uidCookie);
        console.log('UID value:', uidValue);
        
        // 2. API로도 확인 (더 확실한 방법)
        try {
          const response = await fetch('/api/me/summary', { 
            credentials: 'include',
            cache: 'no-store'
          });
          
          console.log('API response status:', response.status);
          
          if (response.status === 200) {
            const data = await response.json();
            console.log('API response data:', data);
            
            if (data.ok && data.uid) {
              setLoggedIn(true);
              setDebugInfo(`API: OK | UID: ${data.uid.substring(0, 8)}...`);
              return;
            }
          }
        } catch (apiError) {
          console.log('API check failed:', apiError);
        }
        
        // 3. 쿠키 기반 판단 (API 실패 시 백업)
        const hasValidUid = Boolean(uidValue && uidValue !== '' && uidValue !== 'undefined');
        setLoggedIn(hasValidUid);
        setDebugInfo(`Cookie: ${hasValidUid ? 'Yes' : 'No'} | Total: ${cookies.length}`);
        
        console.log('Final auth state:', hasValidUid);
        
      } catch (error) {
        console.error('Auth check error:', error);
        setLoggedIn(false);
        setDebugInfo('Error');
      }
    };

    // 초기 확인
    checkAuthStatus();

    // 주기적 확인 (2초마다)
    const interval = setInterval(checkAuthStatus, 2000);

    // 페이지 포커스 시 확인
    const handleFocus = () => {
      setTimeout(checkAuthStatus, 100); // 약간의 지연
    };
    
    // storage 이벤트 (다른 탭에서의 변화 감지)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_changed') {
        setTimeout(checkAuthStatus, 100);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 로그인 상태 변화를 다른 탭에 알리는 함수
  const triggerAuthChange = () => {
    try {
      localStorage.setItem('auth_changed', Date.now().toString());
      localStorage.removeItem('auth_changed');
    } catch (e) {
      // localStorage 사용 불가 시 무시
    }
  };

  // 로그인/로그아웃 후 상태 즉시 업데이트를 위한 함수
  useEffect(() => {
    const handleCustomAuthChange = () => {
      setTimeout(() => {
        // 상태 재확인
        const cookies = document.cookie.split(';').map(c => c.trim());
        const uidCookie = cookies.find(cookie => cookie.startsWith('uid='));
        const uidValue = uidCookie ? uidCookie.split('=')[1] : null;
        const hasValidUid = Boolean(uidValue && uidValue !== '' && uidValue !== 'undefined');
        
        setLoggedIn(hasValidUid);
        setDebugInfo(`Updated: ${hasValidUid ? 'Yes' : 'No'}`);
      }, 100);
    };

    // 커스텀 이벤트 리스너
    window.addEventListener('auth-status-changed', handleCustomAuthChange);
    
    return () => {
      window.removeEventListener('auth-status-changed', handleCustomAuthChange);
    };
  }, []);

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
      
      {/* 디버깅 정보 (개발용) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-400" title={`Debug: ${debugInfo}`}>
          {debugInfo}
        </div>
      )}
    </div>
  );
}