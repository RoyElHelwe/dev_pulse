'use client';

import { UserPlus } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { safeRedirect } from '@/lib/redirect';
import { AuthShell } from './AuthShell';
import type { SignInResponse } from './types';

export interface DevUser {
  id: string;
  displayName: string;
  email: string;
  officeName: string | null;
  role: string | null;
}

interface DevStatus {
  enabled: boolean;
  users: DevUser[];
}

/** Asks the api whether DEV_LOGIN is on (it never is in production). */
export function useDevLogin() {
  const [status, setStatus] = useState<DevStatus | null>(null);
  useEffect(() => {
    let alive = true;
    api<DevStatus>('/auth/dev')
      .then((s) => alive && setStatus(s))
      .catch(() => alive && setStatus({ enabled: false, users: [] }));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}

/**
 * Wraps the sign-in / register forms: when DEV_LOGIN is on, shows the identity
 * switcher instead (with a link back to the real forms).
 */
export function DevSwitcherGate({ children }: { children: React.ReactNode }) {
  const status = useDevLogin();
  const [real, setReal] = useState(false);
  if (!status?.enabled || real) return <>{children}</>;
  return <DevSwitcher initialUsers={status.users} onUseReal={() => setReal(true)} />;
}

function DevSwitcher({ initialUsers, onUseReal }: { initialUsers: DevUser[]; onUseReal: () => void }) {
  const params = useSearchParams();
  const redirect = safeRedirect(params.get('redirect'));
  const [users] = useState(initialUsers);
  const [name, setName] = useState('');
  const [joinUserId, setJoinUserId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function run(key: string, path: string, body: object) {
    setBusy(key);
    setError('');
    try {
      const result = await api<SignInResponse>(path, { body });
      if (result.status === 'signed-in') {
        // Full page load, not a client navigation: the router may still hold the
        // pre-sign-in redirect to /login, and in-memory stores belong to the previous user.
        window.location.replace(redirect);
        return;
      }
      setError('Could not sign in.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach the server.');
    }
    setBusy(null);
  }

  const hosts = users.filter((u) => u.officeName);

  return (
    <AuthShell
      title="Dev sign-in"
      subtitle="DEV_LOGIN is on: pick who you want to be. Testing only, never in production."
      footer={
        <button type="button" onClick={onUseReal} className="font-medium text-zinc-900 underline-offset-4 hover:underline">
          Use the real sign-in
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto" aria-label="Existing users">
          {users.length === 0 && <li className="text-sm text-zinc-500">No users yet. Create one below.</li>}
          {users.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => run(u.id, '/auth/dev/login', { userId: u.id })}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-zinc-100 disabled:opacity-60"
              >
                <Avatar name={u.displayName} src={null} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.displayName}</span>
                  <span className="block truncate text-xs text-zinc-500">
                    {u.email} · {u.officeName ? `${u.officeName} (${u.role?.toLowerCase()})` : 'no office'}
                  </span>
                </span>
                {busy === u.id && <span className="text-xs text-zinc-500">Signing in…</span>}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-col gap-2 border-t border-zinc-100 pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run('new', '/auth/dev/users', { name: name.trim() || undefined, joinUserId: joinUserId || undefined });
          }}
        >
          <p className="text-sm font-medium">Create a test user</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (random if empty)"
            maxLength={60}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
          <select
            value={joinUserId}
            onChange={(e) => setJoinUserId(e.target.value)}
            aria-label="Office to join"
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          >
            <option value="">No office (onboarding)</option>
            {hosts.map((u) => (
              <option key={u.id} value={u.id}>
                Join {u.officeName} (like {u.displayName})
              </option>
            ))}
          </select>
          <Button type="submit" loading={busy === 'new'} disabled={busy !== null} className="w-full rounded-xl">
            <UserPlus className="size-4" /> Create and sign in
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
