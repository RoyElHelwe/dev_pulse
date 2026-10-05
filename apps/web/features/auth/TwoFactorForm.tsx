'use client';

import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { TextField } from '@/components/ui/TextField';
import { api, ApiError } from '@/lib/api';
import { safeRedirect } from '@/lib/redirect';
import { ActiveSessionNotice } from './ActiveSessionNotice';
import { AuthShell } from './AuthShell';
import { useAuth } from './AuthProvider';
import type { ActiveDevice, SignInResponse } from './types';

/** Second sign-in step when 2FA is on: a code from the app, or a backup code. */
export function TwoFactorForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();
  const redirect = safeRedirect(params.get('redirect'));

  const [useBackup, setUseBackup] = useState(false);
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeDevice, setActiveDevice] = useState<ActiveDevice | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const clean = code.replace(/\s/g, '');
    if (useBackup ? clean.length < 10 : !/^\d{6}$/.test(clean)) {
      return setError(
        useBackup ? 'Enter one of your backup codes.' : 'Enter the 6-digit code from your app.',
      );
    }
    setError('');
    setLoading(true);
    try {
      const result = await api<SignInResponse>('/auth/2fa/verify', {
        body: { code: clean, trustDevice },
      });
      if (result.status === 'session-active') {
        setLoading(false);
        return setActiveDevice(result.device);
      }
      if (result.status === 'signed-in') setUser(result.user);
      router.replace(redirect);
    } catch (err) {
      setLoading(false);
      setExpired(err instanceof ApiError && err.code === 'MFA_EXPIRED');
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    }
  }

  return (
    <AuthShell
      title="Two-step verification"
      subtitle={
        useBackup
          ? 'Enter one of the backup codes you saved when you turned on 2FA.'
          : 'Open your authenticator app and enter the 6-digit code for Dev Pulse.'
      }
      footer={
        <Link
          href="/login"
          className="font-medium text-zinc-900 underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      {activeDevice ? (
        <ActiveSessionNotice device={activeDevice} />
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
          {error && (
            <Alert tone="error">
              {error}
              {expired && (
                <Link
                  href="/login"
                  className="mt-1 block font-semibold underline underline-offset-2"
                >
                  Sign in again
                </Link>
              )}
            </Alert>
          )}
          <TextField
            key={useBackup ? 'backup' : 'totp'}
            label={useBackup ? 'Backup code' : 'Authentication code'}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode={useBackup ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            autoFocus
            maxLength={useBackup ? 20 : 6}
            placeholder={useBackup ? 'xxxxx-xxxxx' : '123456'}
            className="[&_input]:text-center [&_input]:font-mono [&_input]:text-lg [&_input]:tracking-[0.35em]"
          />
          <Checkbox
            label="Don't ask again on this browser for 30 days"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
          />
          <Button type="submit" size="lg" loading={loading} className="mt-2 w-full rounded-xl">
            Verify
          </Button>
          <button
            type="button"
            onClick={() => {
              setUseBackup(!useBackup);
              setCode('');
              setError('');
            }}
            className="text-sm text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline"
          >
            {useBackup ? 'Use the authenticator app instead' : 'Lost your phone? Use a backup code'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
