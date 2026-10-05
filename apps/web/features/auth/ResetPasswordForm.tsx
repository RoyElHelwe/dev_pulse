'use client';

import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonStyles } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { api, ApiError } from '@/lib/api';
import { AuthShell } from './AuthShell';
import { fieldErrors, newPasswordSchema } from './schemas';

export function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState(token ? '' : 'This link is missing its code. Ask for a new one.');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = newPasswordSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setFormError('');
    setLoading(true);
    try {
      await api('/auth/password/reset', { body: { token, password: parsed.data.password } });
      setDone(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthShell title="Password changed" subtitle="You can now sign in with your new password. Other devices were signed out.">
        <div className="flex flex-col items-start gap-6">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <CircleCheck className="size-6" aria-hidden="true" />
          </span>
          <Link href="/login" className={buttonStyles('primary', 'lg', 'rounded-xl')}>
            Sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      footer={
        <Link href="/forgot-password" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
          Ask for a new link
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        {/* Lets password managers know which account this password is for. */}
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <TextField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
        />
        <TextField label="Repeat the password" name="confirm" type="password" autoComplete="new-password" error={errors.confirm} />
        <Button type="submit" size="lg" loading={loading} disabled={!token} className="mt-2 w-full rounded-xl">
          Save the new password
        </Button>
      </form>
    </AuthShell>
  );
}
