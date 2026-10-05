'use client';

import { Copy, Download } from 'lucide-react';
import { useState } from 'react';
import QRCode from 'react-qr-code';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import type { User } from '@/features/auth/types';
import { api, ApiError } from '@/lib/api';

type Step =
  | { name: 'idle' }
  | { name: 'scan'; secret: string; otpauthUrl: string }
  | { name: 'codes'; codes: string[] };

export function TwoFactorCard({ user }: { user: User }) {
  const { reloadUser } = useAuth();
  const [step, setStep] = useState<Step>({ name: 'idle' });
  const [field, setField] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  /** Runs one API call with loading + error handling. */
  async function run<T>(key: string, call: () => Promise<T>, then: (value: T) => void | Promise<void>) {
    setError('');
    setLoading(key);
    try {
      await then(await call());
      setField('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    } finally {
      setLoading(null);
    }
  }

  const start = () =>
    run('start', () => api<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', { body: { password: field || undefined } }), (data) =>
      setStep({ name: 'scan', ...data }),
    );
  const confirm = () =>
    run('confirm', () => api<{ backupCodes: string[] }>('/auth/2fa/enable', { body: { code: field.trim() } }), async (data) => {
      setStep({ name: 'codes', codes: data.backupCodes });
      await reloadUser();
    });
  const regenerate = () =>
    run('regenerate', () => api<{ backupCodes: string[] }>('/auth/2fa/backup-codes', { body: { code: field.trim() } }), (data) =>
      setStep({ name: 'codes', codes: data.backupCodes }),
    );
  const disable = () => run('disable', () => api('/auth/2fa/disable', { body: { code: field.trim() } }), reloadUser);

  const badge = user.twoFactorEnabled ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>;

  if (step.name === 'codes') {
    return (
      <Card title="Save your backup codes" description="Each code works once if you lose your phone. You won't see them again." aside={badge}>
        <BackupCodes codes={step.codes} />
        <Button className="mt-5" onClick={() => setStep({ name: 'idle' })}>
          I saved them
        </Button>
      </Card>
    );
  }

  if (step.name === 'scan') {
    return (
      <Card title="Scan the QR code" description="Use Google Authenticator, Authy, 1Password or any authenticator app." aside={badge}>
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
          <div className="justify-self-start rounded-2xl bg-white p-3 ring-1 ring-zinc-200">
            {/* Drawn in the browser: the link contains the secret, it never leaves this page. */}
            <QRCode value={step.otpauthUrl} size={168} />
          </div>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-600">
              Can't scan? Enter this key in the app:
              <code className="mt-1 block font-mono text-sm break-all text-zinc-900">{step.secret.match(/.{1,4}/g)?.join(' ')}</code>
            </p>
            {error && <Alert tone="error">{error}</Alert>}
            <TextField
              label="6-digit code from the app"
              value={field}
              onChange={(e) => setField(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="sm:max-w-56"
            />
            <div className="flex gap-2">
              <Button loading={loading === 'confirm'} onClick={confirm}>
                Turn on
              </Button>
              <Button variant="ghost" onClick={() => setStep({ name: 'idle' })}>
                Cancel
              </Button>
            </div>
            <p className="text-xs text-zinc-500">Turning it on signs you out on your other devices.</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!user.twoFactorEnabled) {
    return (
      <Card
        title="Two-factor authentication"
        description="Ask for a code from your phone when you sign in, so a stolen password is not enough."
        aside={badge}
      >
        <div className="grid gap-4 sm:max-w-sm">
          {error && <Alert tone="error">{error}</Alert>}
          {user.hasPassword && (
            <TextField
              label="Confirm with your password"
              type="password"
              autoComplete="current-password"
              value={field}
              onChange={(e) => setField(e.target.value)}
            />
          )}
          <Button className="justify-self-start" loading={loading === 'start'} onClick={start}>
            Set up 2FA
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Two-factor authentication" description="Your account asks for a code from your authenticator app." aside={badge}>
      <div className="grid gap-4 sm:max-w-sm">
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Code from your app (or a backup code)"
          value={field}
          onChange={(e) => setField(e.target.value)}
          autoComplete="one-time-code"
          maxLength={20}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={loading === 'regenerate'} onClick={regenerate}>
            New backup codes
          </Button>
          <Button variant="ghost" className="text-rose-700 hover:bg-rose-50 hover:text-rose-800" loading={loading === 'disable'} onClick={disable}>
            Turn off 2FA
          </Button>
        </div>
      </div>
    </Card>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Dev Pulse backup codes\n\n${text}\n`], { type: 'text/plain' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'dev-pulse-backup-codes.txt' });
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl bg-zinc-50 p-4 font-mono text-sm ring-1 ring-zinc-200 sm:max-w-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          <Copy className="size-3.5" /> {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="secondary" size="sm" onClick={download}>
          <Download className="size-3.5" /> Download
        </Button>
      </div>
    </div>
  );
}
