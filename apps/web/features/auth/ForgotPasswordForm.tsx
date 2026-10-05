'use client';

import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { api, ApiError } from '@/lib/api';
import { AuthShell } from './AuthShell';
import { emailField } from './schemas';

export function ForgotPasswordForm() {
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = emailField.safeParse(new FormData(event.currentTarget).get('email'));
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError('');
    setFormError('');
    setLoading(true);
    try {
      await api('/auth/password/forgot', { body: { email: parsed.data } });
      setSentTo(parsed.data);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  const back = (
    <Link href="/login" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
      Back to sign in
    </Link>
  );

  if (sentTo) {
    return (
      <AuthShell title="Check your inbox" footer={back}>
        <div className="flex flex-col items-start gap-5">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <MailCheck className="size-6" aria-hidden="true" />
          </span>
          <p className="text-zinc-600">
            If an account exists for <b className="text-zinc-900">{sentTo}</b>, we sent a link to choose a new
            password. It works for 1 hour.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to choose a new one." footer={back}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField label="Email" name="email" type="email" autoComplete="email" autoFocus error={error} />
        <Button type="submit" size="lg" loading={loading} className="mt-2 w-full rounded-xl">
          Send the link
        </Button>
      </form>
    </AuthShell>
  );
}
