// components/auth/AuthStatusButton.tsx
'use client';

import { useEffect, useState } from 'react';
import LogoutButton from '@/components/auth/LogoutButton';

export default function AuthStatusButton() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const cookies = document.cookie.split(';').map(c => c.trim());
        const uidCookie = cookies.find(cookie => cookie.startsWith('uid='));
        const uidValue = uidCookie ? uidCookie.split('=')[1] : null;
        
        console.log('=== Auth Status Check ===');
        console.log('All cookies:', document.cookie);
        console.log('UID cookie:', uidCookie);
        console.log('UID value:', uidValue);
        
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
        setDebugInfo(`Updated: ${hasValidUid ? 'Yes' : 'No'}`);
      }, 100);
    };

    window.addEventListener('auth-status-changed', handleCustomAuthChange);
    
    return () => {
      window.removeEventListener('auth-status-changed', handleCustomAuthChange);
    };
  }, []);

  if (loggedIn === null) {
    return (
      <div style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-primary)',
        borderRadius: '8px',
        padding: '8px 16px',
        color: 'var(--text-secondary)',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div className="loading-spinner" style={{
          width: '12px',
          height: '12px',
          border: '2px solid var(--border-primary)',
          borderTop: '2px solid var(--text-secondary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        확인중...
      </div>
    );
  }

  if (loggedIn) {
    return <LogoutButton />;
  }

  return (
    <a 
      href="/auth/sign-in" 
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
        <path d="M10 17l5-5-5-5v3H3v4h7v3z"/>
        <path d="M21 3H11v2h10v14H11v2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
      </svg>
      로그인
    </a>
  );
}