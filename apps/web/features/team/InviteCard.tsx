// Card for sending team invitations by email and copying the invitation link.
// Rendered on the team settings page for workspace managers.

'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { emailField } from '@/features/auth/schemas';
import type { Role } from '@/features/workspace/types';
import { api } from '@/lib/api';
import { CopyLink } from './CopyLink';
import { getErrorMessage } from './teamHelpers';

interface InviteCardProps {
  isOwner: boolean;
  onInvited: () => void;
}

/** Form card allowing owners and admins to invite new team members. */
export function InviteCard({ isOwner, onInvited }: InviteCardProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('MEMBER');
  const [error, setError] = useState('');
  const [sent, setSent] = useState<{ email: string; link: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = emailField.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError('');
    setLoading(true);
    try {
      const result = await api<{ link: string }>('/workspace/invitations', { body: { email: parsed.data, role } });
      setSent({ email: parsed.data, link: result.link });
      setEmail('');
      onInvited();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Invite your team" description="They get an email with a link. It works for 7 days, only for that address.">
      <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} placeholder="name@company.com" />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="MEMBER">Member</option>
          {isOwner && <option value="ADMIN">Admin</option>}
        </Select>
        <Button type="submit" loading={loading} className="h-11 sm:mb-0">
          Send invitation
        </Button>
      </form>
      {sent && (
        <div className="mt-4 flex flex-col gap-2">
          <Alert tone="success">Invitation sent to {sent.email}. You can also share this link with them:</Alert>
          <CopyLink link={sent.link} />
        </div>
      )}
      <p className="mt-3 text-xs text-zinc-500">Admins can invite people and edit the office. Members can use the office.</p>
    </Card>
  );
}
