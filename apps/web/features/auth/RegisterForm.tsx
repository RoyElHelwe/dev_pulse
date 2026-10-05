'use client';

import { MailCheck } from 'lucide-react';
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
import { fieldErrors, registerSchema } from './schemas';
import type { SignInResponse } from './types';

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();
  const redirect = safeRedirect(params.get('redirect'));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const parsed = registerSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});

    setLoading(true);
    try {
      const result = await api<SignInResponse>('/auth/register', { body: parsed.data });
      if (result.status === 'verification-required') {
        setLoading(false);
        return setSentTo(parsed.data.email);
      }
      if (result.status === 'signed-in') setUser(result.user);
      router.replace(redirect);
    } catch (error) {
      setLoading(false);
      if (error instanceof ApiError && error.field) return setErrors({ [error.field]: error.message });
      setFormError(error instanceof ApiError ? error.message : 'Could not reach the server.');
    }
  }

  if (sentTo) {
    return (
      <AuthShell title="Check your inbox" subtitle={<>We sent a confirmation link to <b className="text-zinc-900">{sentTo}</b>.</>}>
        <div className="flex flex-col items-start gap-6">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <MailCheck className="size-6" aria-hidden="true" />
          </span>
          <p className="text-zinc-600">Click the link in the email to activate your account, then sign in.</p>
          <Link href="/login" className="font-medium underline underline-offset-4">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up your space in a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <OAuthButtons redirect={redirect} />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <TextField label="Your name" name="displayName" autoComplete="name" maxLength={50} error={errors.displayName} />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={params.get('email') ?? undefined}
          error={errors.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
        />
        <Button type="submit" size="lg" loading={loading} className="mt-2 w-full rounded-xl">
          Create account
        </Button>
        <p className="text-center text-xs text-zinc-500">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-2">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}
