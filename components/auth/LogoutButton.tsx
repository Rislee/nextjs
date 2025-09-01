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

      try {
        const logoutRes = await fetch('/api/auth/logout', { 
          method: 'POST', 
          credentials: 'include' 
        });
        console.log('Logout API response:', logoutRes.status);
      } catch (e) {
        console.log('Logout API error, continuing...', e);
      }

      const cookies = document.cookie.split(';');
      console.log('Current cookies before logout:', cookies.length);
      
      triggerAuthChange();
      
      setTimeout(() => {
        console.log('Redirecting to sign-in...');
        window.location.href = '/auth/sign-in';
      }, 500);
      
    } catch (error) {
      console.error('Logout error:', error);
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
      className={className ?? "inneros-button-secondary"}
      style={{
        fontSize: '14px',
        minHeight: '36px',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        opacity: loading ? 0.7 : 1,
        cursor: loading ? 'not-allowed' : 'pointer'
      }}
    >
      {loading ? (
        <>
          <div className="loading-spinner" style={{
            width: '12px',
            height: '12px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTop: '2px solid currentColor',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          로그아웃 중...
        </>
      ) : (
        <>
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5z"/>
            <path d="M4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
          </svg>
          로그아웃
        </>
      )}
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}