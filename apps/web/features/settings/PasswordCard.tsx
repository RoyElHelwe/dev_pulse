'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { fieldErrors, newPasswordSchema } from '@/features/auth/schemas';
import type { User } from '@/features/auth/types';
import { api, ApiError } from '@/lib/api';

/** Change the password, or set one for accounts created with Google / GitHub / 42. */
export function PasswordCard({ user }: { user: User }) {
  const { reloadUser } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const parsed = newPasswordSchema.safeParse(values);
    const next = parsed.success ? {} : fieldErrors(parsed.error);
    if (user.hasPassword && !values.currentPassword) next.currentPassword = 'Enter your current password.';
    setErrors(next);
    setResult(null);
    if (Object.keys(next).length > 0 || !parsed.success) return;

    setLoading(true);
    try {
      await api('/auth/password/change', {
        body: { currentPassword: values.currentPassword || undefined, newPassword: parsed.data.password },
      });
      form.reset();
      setResult({ tone: 'success', text: 'Password saved. Your other devices were signed out.' });
      await reloadUser();
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field]: err.message });
      else setResult({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not reach the server.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      title={user.hasPassword ? 'Password' : 'Set a password'}
      description={
        user.hasPassword
          ? 'Changing it signs you out on your other devices.'
          : 'You sign in with an external account. Add a password to also sign in with your email.'
      }
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:max-w-sm">
        {result && <Alert tone={result.tone}>{result.text}</Alert>}
        <input type="text" name="username" autoComplete="username" value={user.email} hidden readOnly />
        {user.hasPassword && (
          <TextField
            label="Current password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            error={errors.currentPassword}
          />
        )}
        <TextField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
        />
        <TextField label="Repeat the new password" name="confirm" type="password" autoComplete="new-password" error={errors.confirm} />
        <Button type="submit" loading={loading} className="justify-self-start">
          {user.hasPassword ? 'Change password' : 'Set password'}
        </Button>
      </form>
    </Card>
  );
}
