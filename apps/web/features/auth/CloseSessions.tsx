'use client';

import { CircleX, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonStyles } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { api, ApiError } from '@/lib/api';
import { AuthShell } from './AuthShell';
import { useAuth } from './AuthProvider';

type State = 'closing' | 'password' | 'failed';

/**
 * Opened from the "Close your other sessions" email. Closes every session of
 * the account, then goes to the sign-in page. In another browser than the one
 * that asked for the link, the password is needed too.
 */
export function CloseSessions() {
  const token = useSearchParams().get('token');
  const router = useRouter();
  const { setUser } = useAuth();
  const [state, setState] = useState<State>(token ? 'closing' : 'failed');
  const [message, setMessage] = useState(token ? '' : 'This link is missing its code.');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);
  const sent = useRef(false); // the link works once: don't send it twice in dev (StrictMode)

  const close = useCallback(
    async (password?: string) => {
      try {
        await api('/auth/sessions/close', { body: { token, password } });
        setUser(null);
        router.replace('/login?notice=sessions_closed');
      } catch (error) {
        const code = error instanceof ApiError ? error.code : undefined;
        const text = error instanceof ApiError ? error.message : 'Could not reach the server.';
        if (code === 'PASSWORD_REQUIRED') {
          setState('password');
          setMessage(text);
        } else if (code === 'WRONG_PASSWORD') {
          setPasswordError(text);
        } else {
          setState('failed');
          setMessage(text);
        }
      }
    },
    [token, router, setUser],
  );

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    void close();
  }, [token, close]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    if (!password) return setPasswordError('Enter your password.');
    setPasswordError('');
    setLoading(true);
    await close(password);
    setLoading(false);
  }

  if (state === 'password') {
    return (
      <AuthShell title="Confirm it's you" subtitle={message}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <LogOut className="size-6" aria-hidden="true" />
          </span>
          <input type="text" name="username" autoComplete="username" hidden readOnly />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            error={passwordError}
          />
          <Button type="submit" size="lg" loading={loading} className="mt-2 w-full rounded-xl">
            Close all my sessions
          </Button>
        </form>
      </AuthShell>
    );
  }

  if (state === 'failed') {
    return (
      <AuthShell title="Link not valid" subtitle={message}>
        <div className="flex flex-col items-start gap-6">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <CircleX className="size-6" aria-hidden="true" />
          </span>
          <Alert tone="info">Sign in again to ask for a new link.</Alert>
          <Link href="/login" className={buttonStyles('primary', 'lg', 'rounded-xl')}>
            Go to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Closing your sessions…" subtitle="One moment, signing out every device.">
      {null}
    </AuthShell>
  );
}
