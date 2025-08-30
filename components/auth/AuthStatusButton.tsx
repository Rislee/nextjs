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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setLoggedIn(!!data.session);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      setLoggedIn(!!session);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [supabase]);

  if (loggedIn === null) return null;
  return loggedIn ? (
    <LogoutButton />
  ) : (
    <a href="/auth/sign-in" className="rounded border px-3 py-1 text-sm hover:bg-gray-50">
      로그인
    </a>
  );
}
