'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { api, ApiError } from '@/lib/api';
import { safeRedirect } from '@/lib/redirect';
import { AuthShell } from './AuthShell';
import { useAuth } from './AuthProvider';
import { OAuthButtons } from './OAuthButtons';
import { fieldErrors, loginSchema } from './schemas';
import type { SignInResponse } from './types';

/** Messages for ?error=... after a Google / GitHub / 42 redirect. */
const OAUTH_ERRORS: Record<string, string> = {
  oauth_denied: 'Sign-in was cancelled.',
  oauth_state: 'That sign-in link expired. Please try again.',
  oauth_failed: 'We could not sign you in with that account. Please try again.',
  oauth_email_missing: 'That account has no email address we can use.',
  oauth_email_unverified: 'Please verify your email with that provider first.',
  oauth_unavailable: 'This sign-in method is not available.',
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();
  const redirect = safeRedirect(params.get('redirect'));
  const oauthError = params.get('error');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState(oauthError ? (OAUTH_ERRORS[oauthError] ?? OAUTH_ERRORS.oauth_failed) : '');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setNotice('');
    setUnverifiedEmail('');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});

    setLoading(true);
    try {
      const result = await api<SignInResponse>('/auth/login', { body: parsed.data });
      if (result.status === 'two-factor-required') {
        router.push(`/two-factor?redirect=${encodeURIComponent(redirect)}`);
        return;
      }
      setUser(result.user);
      router.replace(redirect);
    } catch (error) {
      setLoading(false);
      if (error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED') setUnverifiedEmail(parsed.data.email);
      setFormError(error instanceof ApiError ? error.message : 'Could not reach the server.');
    }
  }

  async function resendEmail() {
    await api('/auth/email/resend', { body: { email: unverifiedEmail } }).catch(() => undefined);
    setFormError('');
    setUnverifiedEmail('');
    setNotice('We sent you a new link. Check your inbox (and spam).');
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to get back to your office."
      footer={
        <>
          New to Dev Pulse?{' '}
          <Link href="/register" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <OAuthButtons redirect={redirect} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && (
          <Alert tone="error">
            {formError}
            {unverifiedEmail && (
              <button type="button" onClick={resendEmail} className="mt-1 block font-semibold underline underline-offset-2">
                Send the link again
              </button>
            )}
          </Alert>
        )}
        {notice && <Alert tone="success">{notice}</Alert>}
        <TextField label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          error={errors.password}
          labelAside={
            <Link href="/forgot-password" className="text-sm text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline">
              Forgot password?
            </Link>
          }
        />
        <Button type="submit" size="lg" loading={loading} className="mt-2 w-full rounded-xl">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
