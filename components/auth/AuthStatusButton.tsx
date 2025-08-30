// components/auth/AuthStatusButton.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import LogoutButton from '@/components/auth/LogoutButton';

export default function AuthStatusButton() {
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );
  
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 초기 세션 확인
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        setLoggedIn(!!session);
      } catch (error) {
        console.error('Session check error:', error);
        setLoggedIn(false);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // 인증 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, !!session);
        setLoggedIn(!!session);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // 로딩 중이거나 상태가 결정되지 않았으면 아무것도 표시하지 않음
  if (loading || loggedIn === null) {
    return (
      <div className="rounded border px-3 py-1 text-sm bg-gray-100 text-gray-400">
        확인중...
      </div>
    );
  }

  return loggedIn ? (
    <LogoutButton />
  ) : (
    <a href="/auth/sign-in" className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
      로그인
    </a>
  );
}