'use client';

import { CircleX, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonStyles } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { ROLE_LABEL, type Role } from '@/features/workspace/types';
import { api, ApiError } from '@/lib/api';

interface Invitation {
  workspaceName: string;
  invitedBy: string;
  email: string;
  role: Role;
  status: 'pending' | 'expired' | 'accepted' | 'declined' | 'revoked';
  expiresAt: string;
  accountExists: boolean;
}

const CLOSED: Record<Exclude<Invitation['status'], 'pending'>, string> = {
  expired: 'This invitation has expired. Ask the organiser to send a new one.',
  accepted: 'This invitation was already used.',
  declined: 'This invitation was declined.',
  revoked: 'This invitation was cancelled by the organiser.',
};

/** The page an invitation email links to. */
export function InvitationView({ token }: { token: string }) {
  const { status, user, reloadUser, signOut } = useAuth();
  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    api<Invitation>(`/invitations/${encodeURIComponent(token)}`).then(setInvitation, (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.'),
    );
  }, [token]);

  async function accept() {
    setBusy('accept');
    setError('');
    try {
      await api(`/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST' });
      await reloadUser();
      router.replace('/office'); // straight into the office
    } catch (err) {
      setBusy(null);
      setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
    }
  }

  async function decline() {
    setBusy('decline');
    await api(`/invitations/${encodeURIComponent(token)}/decline`, { method: 'POST' }).catch(() => undefined);
    setBusy(null);
    setDeclined(true);
  }

  if (!invitation) {
    return error ? <Closed message={error} /> : <p className="py-24 text-center text-sm text-zinc-500">Loading…</p>;
  }
  if (declined) return <Closed message="You declined the invitation." />;
  if (invitation.status !== 'pending') return <Closed message={CLOSED[invitation.status]} />;

  const here = `/invite/${token}`;
  const sameAccount = user?.email === invitation.email;

  return (
    <div className="mx-auto max-w-md text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <PartyPopper className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {invitation.invitedBy} invited you to {invitation.workspaceName}
      </h1>
      <p className="mt-3 text-zinc-600">
        Join the virtual office as <b className="text-zinc-900">{ROLE_LABEL[invitation.role].toLowerCase()}</b>. The
        invitation is for <b className="text-zinc-900">{invitation.email}</b>.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        {error && <Alert tone="error">{error}</Alert>}

        {status === 'loading' && <p className="text-sm text-zinc-500">Loading…</p>}

        {status === 'signed-out' &&
          (invitation.accountExists ? (
            <Link
              href={`/login?redirect=${encodeURIComponent(here)}&email=${encodeURIComponent(invitation.email)}`}
              className={buttonStyles('primary', 'lg', 'rounded-xl')}
            >
              Sign in to join
            </Link>
          ) : (
            <Link
              href={`/register?redirect=${encodeURIComponent(here)}&email=${encodeURIComponent(invitation.email)}`}
              className={buttonStyles('primary', 'lg', 'rounded-xl')}
            >
              Create your account to join
            </Link>
          ))}

        {status === 'signed-in' && !sameAccount && (
          <>
            <Alert tone="error">
              You are signed in as {user?.email}. Sign out, then open this link again with {invitation.email}.
            </Alert>
            <Button size="lg" variant="secondary" className="rounded-xl" onClick={() => signOut()}>
              Sign out
            </Button>
          </>
        )}

        {status === 'signed-in' && sameAccount && user?.workspace && (
          <Alert>
            You already belong to {user.workspace.name}. Leave it from the Team page to join {invitation.workspaceName}.
          </Alert>
        )}

        {status === 'signed-in' && sameAccount && !user?.workspace && (
          <>
            <Button size="lg" className="rounded-xl" loading={busy === 'accept'} disabled={busy !== null} onClick={accept}>
              Join {invitation.workspaceName}
            </Button>
            <Button size="lg" variant="ghost" className="rounded-xl" loading={busy === 'decline'} disabled={busy !== null} onClick={decline}>
              Decline
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Closed({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
        <CircleX className="size-7" aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Invitation not available</h1>
      <p className="mt-3 text-zinc-600">{message}</p>
      <Link href="/" className={buttonStyles('secondary', 'md', 'mt-8')}>
        Back to home
      </Link>
    </div>
  );
}
