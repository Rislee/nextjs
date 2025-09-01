// components/auth/DashboardButton.tsx
'use client';

import { useEffect, useState } from 'react';

export default function DashboardButton() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const cookies = document.cookie.split(';').map(c => c.trim());
        const uidCookie = cookies.find(cookie => cookie.startsWith('uid='));
        const uidValue = uidCookie ? uidCookie.split('=')[1] : null;
        
        try {
          const response = await fetch('/api/me/summary', { 
            credentials: 'include',
            cache: 'no-store'
          });
          
          if (response.status === 200) {
            const data = await response.json();
            if (data.ok && data.uid) {
              setLoggedIn(true);
              return;
            }
          }
        } catch (apiError) {
          console.log('API check failed:', apiError);
        }
        
        const hasValidUid = Boolean(uidValue && uidValue !== '' && uidValue !== 'undefined');
        setLoggedIn(hasValidUid);
        
      } catch (error) {
        console.error('Auth check error:', error);
        setLoggedIn(false);
      }
    };

    checkAuthStatus();
    const interval = setInterval(checkAuthStatus, 2000);

    const handleFocus = () => {
      setTimeout(checkAuthStatus, 100);
    };
    
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

  useEffect(() => {
    const handleCustomAuthChange = () => {
      setTimeout(() => {
        const cookies = document.cookie.split(';').map(c => c.trim());
        const uidCookie = cookies.find(cookie => cookie.startsWith('uid='));
        const uidValue = uidCookie ? uidCookie.split('=')[1] : null;
        const hasValidUid = Boolean(uidValue && uidValue !== '' && uidValue !== 'undefined');
        
        setLoggedIn(hasValidUid);
      }, 100);
    };

    window.addEventListener('auth-status-changed', handleCustomAuthChange);
    
    return () => {
      window.removeEventListener('auth-status-changed', handleCustomAuthChange);
    };
  }, []);

  // 로그인되지 않은 사용자에게는 버튼을 보여주지 않음
  if (!loggedIn) {
    return null;
  }

  return (
    <a 
      href="/dashboard" 
      className="inneros-button-secondary"
      style={{
        textDecoration: 'none',
        fontSize: '14px',
        minHeight: '36px',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
      </svg>
      대시보드
    </a>
  );
}