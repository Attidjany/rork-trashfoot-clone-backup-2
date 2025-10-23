'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState<'exchanging' | 'redirecting' | 'error'>('exchanging');
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    const doExchange = async () => {
      // Supabase sends a PKCE "code" we must exchange for a session
      const code = params.get('code');
      const type = params.get('type'); // e.g. signup | recovery | oauth

      if (!code) {
        setMessage('error');
        setErrorText('Missing `code` in URL. Make sure the redirect URL is allowed in Supabase Auth settings.');
        return;
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        setMessage('error');
        setErrorText(error.message || 'Failed to exchange code');
        return;
      }

      // If this came from a password recovery flow, send user to the "set new password" screen.
      if (type === 'recovery') {
        setMessage('redirecting');
        router.replace('/auth/reset-password?from=recovery');
        return;
      }

      // For email confirmation or OAuth, you can choose where to land.
      // If you have a dashboard route, send users there; otherwise home.
      setMessage('redirecting');
      router.replace('/dashboard'); // or: router.replace('/')
    };

    void doExchange();
    // We only want to run once per visit with the current query string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
      {message === 'exchanging' && <p>Finishing sign-in…</p>}
      {message === 'redirecting' && <p>Redirecting…</p>}
      {message === 'error' && (
        <div>
          <p style={{ color: 'crimson' }}>Auth error:</p>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{errorText}</pre>
        </div>
      )}
    </main>
  );
}