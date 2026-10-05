'use client';

import { Laptop, Smartphone, Terminal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';

interface Session {
  id: string;
  userAgent: string | null;
  ip: string | null;
  signedInAt: string;
  lastActiveAt: string;
  current: boolean;
}

/** "Chrome on macOS" from a user-agent string (good enough for a list). */
function describe(userAgent: string | null) {
  const ua = userAgent ?? '';
  const browser =
    [['Edg/', 'Edge'], ['OPR/', 'Opera'], ['Firefox/', 'Firefox'], ['Chrome/', 'Chrome'], ['Safari/', 'Safari'], ['curl/', 'curl']].find(
      ([token]) => ua.includes(token),
    )?.[1] ?? 'Unknown browser';
  const os =
    [['iPhone', 'iOS'], ['iPad', 'iPadOS'], ['Android', 'Android'], ['Mac OS X', 'macOS'], ['Windows', 'Windows'], ['Linux', 'Linux']].find(
      ([token]) => ua.includes(token),
    )?.[1];
  const mobile = /iPhone|Android|iPad/.test(ua);
  return { label: os ? `${browser} on ${os}` : browser, Icon: browser === 'curl' ? Terminal : mobile ? Smartphone : Laptop };
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
function timeAgo(date: string) {
  const minutes = Math.round((new Date(date).getTime() - Date.now()) / 60000);
  if (minutes > -1) return 'just now';
  if (minutes > -60) return relative.format(minutes, 'minute');
  if (minutes > -60 * 24) return relative.format(Math.round(minutes / 60), 'hour');
  return relative.format(Math.round(minutes / 1440), 'day');
}

export function SessionsCard() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => api<Session[]>('/auth/sessions').then(setSessions, () => setSessions([])), []);
  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(id: string) {
    setBusy(id);
    await api(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => undefined);
    setBusy(null);
    await load();
  }

  return (
    <Card
      title="Signed-in devices"
      description="Sign out a device you don't recognise."
      aside={
        <Button
          variant="secondary"
          size="sm"
          loading={busy === 'all'}
          onClick={async () => {
            setBusy('all');
            await signOut({ everywhere: true });
            router.replace('/login');
          }}
        >
          Sign out everywhere
        </Button>
      }
    >
      <ul className="divide-y divide-zinc-100">
        {sessions === null && <li className="py-3 text-sm text-zinc-500">Loading…</li>}
        {sessions?.map((s) => {
          const { label, Icon } = describe(s.userAgent);
          return (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {label} {s.current && <Badge tone="success">This device</Badge>}
                </p>
                <p className="truncate text-xs text-zinc-500">
                  {s.ip ? `${s.ip} · ` : ''}active {timeAgo(s.lastActiveAt)} · signed in {timeAgo(s.signedInAt)}
                </p>
              </div>
              {!s.current && (
                <Button variant="ghost" size="sm" loading={busy === s.id} onClick={() => revoke(s.id)}>
                  Sign out
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
