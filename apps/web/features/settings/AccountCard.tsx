'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { User } from '@/features/auth/types';
import { api } from '@/lib/api';

const PROVIDER_NAMES: Record<string, string> = { google: 'Google', github: 'GitHub', '42': '42' };

export function AccountCard({ user }: { user: User }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function resend() {
    setLoading(true);
    await api('/auth/email/resend', { body: { email: user.email } }).catch(() => undefined);
    setLoading(false);
    setSent(true);
  }

  return (
    <Card
      title="Account"
      description={user.email}
      aside={user.emailVerified ? <Badge tone="success">Email confirmed</Badge> : <Badge tone="warning">Email not confirmed</Badge>}
    >
      <div className="flex flex-col gap-3 text-sm text-zinc-600">
        {user.providers.length > 0 && (
          <p>Linked sign-in: {user.providers.map((p) => PROVIDER_NAMES[p] ?? p).join(', ')}</p>
        )}
        {!user.emailVerified &&
          (sent ? (
            <p className="text-emerald-700">Sent! Check your inbox for the confirmation link.</p>
          ) : (
            <Button variant="secondary" size="sm" className="self-start" loading={loading} onClick={resend}>
              Send the confirmation email again
            </Button>
          ))}
      </div>
    </Card>
  );
}
