'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle'|'checking'|'ready'|'updating'|'success'|'error'>('checking');
  const [errorText, setErrorText] = useState<string | null>(null);

  // Ensure we *do* have a session (set by /auth/callback with type=recovery)
  useEffect(() => {
    const init = async () => {
      setStatus('checking');
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setStatus('error');
        setErrorText(error.message);
        return;
      }
      if (!data.session) {
        setStatus('error');
        setErrorText('No active recovery session. Please use the password reset link again.');
        return;
      }
      setStatus('ready');
    };
    void init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    if (password.length < 8) {
      setErrorText('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorText('Passwords do not match.');
      return;
    }

    setStatus('updating');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus('error');
      setErrorText(error.message || 'Failed to update password.');
      return;
    }

    setStatus('success');

    // Small delay so the user sees the success message
    setTimeout(() => {
      // Send them to your dashboard/home after update
      router.replace('/dashboard'); // or '/'
    }, 800);
  };

  const from = params.get('from'); // just to display context if needed

  return (
    <main style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Set a new password</h1>
      {from === 'recovery' && (
        <p style={{ color: '#666', marginTop: 0 }}>You’re completing a password recovery.</p>
      )}

      {status === 'checking' && <p>Checking your session…</p>}

      {status === 'ready' && (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>New password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              style={{ padding: '10px 12px' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Confirm new password</span>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="********"
              style={{ padding: '10px 12px' }}
            />
          </label>

          <button
            type="submit"
            disabled={status === 'updating'}
            style={{ padding: '10px 12px', cursor: 'pointer' }}
          >
            {status === 'updating' ? 'Updating…' : 'Update password'}
          </button>

          {errorText && (
            <p style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>{errorText}</p>
          )}
        </form>
      )}

      {status === 'success' && (
        <p style={{ color: 'green' }}>Password updated. Redirecting…</p>
      )}

      {status === 'error' && (
        <div>
          <p style={{ color: 'crimson' }}>There was a problem.</p>
          {errorText && <pre style={{ whiteSpace: 'pre-wrap' }}>{errorText}</pre>}
        </div>
      )}
    </main>
  );
}