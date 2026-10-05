'use client';

import { CircleCheck, CircleX } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { buttonStyles } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { AuthShell } from './AuthShell';
import { useAuth } from './AuthProvider';

/** Opened from the "Confirm your email" message. */
export function VerifyEmail() {
  const token = useSearchParams().get('token');
  const { status, reloadUser } = useAuth();
  const [state, setState] = useState<'checking' | 'done' | 'failed'>(token ? 'checking' : 'failed');
  const [message, setMessage] = useState(token ? '' : 'This link is missing its code.');
  const sent = useRef(false); // the link works once: don't send it twice in dev (StrictMode)

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    api('/auth/email/verify', { body: { token } })
      .then(async () => {
        setState('done');
        await reloadUser();
      })
      .catch((err) => {
        setState('failed');
        setMessage(err instanceof ApiError ? err.message : 'Could not reach the server.');
      });
  }, [token, reloadUser]);

  const next = status === 'signed-in' ? { href: '/office', label: 'Go to the office' } : { href: '/login', label: 'Sign in' };

  return (
    <AuthShell
      title={state === 'done' ? 'Email confirmed' : state === 'failed' ? 'Link not valid' : 'Confirming your email…'}
      subtitle={state === 'done' ? 'Thanks! Your email address is confirmed.' : message}
    >
      {state !== 'checking' && (
        <div className="flex flex-col items-start gap-6">
          <span
            className={`flex size-12 items-center justify-center rounded-2xl ${state === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
          >
            {state === 'done' ? <CircleCheck className="size-6" /> : <CircleX className="size-6" />}
          </span>
          <Link href={next.href} className={buttonStyles('primary', 'lg', 'rounded-xl')}>
            {next.label}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
