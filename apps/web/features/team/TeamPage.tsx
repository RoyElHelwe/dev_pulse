'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/AuthProvider';
import { emailField } from '@/features/auth/schemas';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { LayoutPreview } from '@/features/workspace/LayoutPreview';
import { canManage, type MyWorkspace, ROLE_LABEL, type Role } from '@/features/workspace/types';
import { numberedDesks } from '@/game/layout/derive';
import type { OfficeLayout } from '@/game/layout/types';
import { cn } from '@/lib/cn';
import { api, ApiError } from '@/lib/api';
import { CopyLink } from './CopyLink';

interface Member {
  userId: string;
  displayName: string;
  email: string;
  role: Role;
  character: string;
  deskId: string | null;
  joinedAt: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  expired: boolean;
}

const days = (date: string) => Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000));
const message = (err: unknown) => (err instanceof ApiError ? err.message : 'Could not reach the server.');

export function TeamPage() {
  const { status, user, reloadUser } = useAuth();
  const router = useRouter();
  const [workspace, setWorkspace] = useState<MyWorkspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);

  const manager = canManage(workspace?.role);
  const owner = workspace?.role === 'OWNER';

  const load = useCallback(async () => {
    const mine = await api<MyWorkspace>('/workspace');
    setWorkspace(mine);
    setMembers(await api<Member[]>('/workspace/members'));
    if (canManage(mine.role)) setInvitations(await api<PendingInvitation[]>('/workspace/invitations'));
  }, []);

  useEffect(() => {
    if (status === 'signed-out') router.replace('/login?redirect=/team');
    if (status !== 'signed-in') return;
    if (!user?.workspace) return void router.replace('/onboarding');
    void load();
  }, [status, user, router, load]);

  if (!workspace) return <p className="py-20 text-center text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      {manager && <InviteCard isOwner={owner} onInvited={load} />}
      {manager && invitations.length > 0 && <InvitationsCard invitations={invitations} onChange={load} />}
      <MembersCard
        members={members}
        myId={user!.id}
        isOwner={owner}
        canAssignDesks={manager}
        desks={numberedDesks(workspace.layout).map(({ desk, name }) => ({ id: desk.id, name }))}
        onChange={load}
        onLeft={async () => {
          await reloadUser();
          router.replace('/onboarding');
        }}
      />
      {manager && (
        <OfficeCard
          workspace={workspace}
          isOwner={owner}
          onRenamed={load}
          onDeleted={async () => {
            await reloadUser();
            router.replace('/onboarding?notice=deleted');
          }}
        />
      )}
    </div>
  );
}

function InviteCard({ isOwner, onInvited }: { isOwner: boolean; onInvited: () => void }) {
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
      setError(message(err));
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

function InvitationsCard({ invitations, onChange }: { invitations: PendingInvitation[]; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<{ id: string; link: string } | null>(null);

  async function run(id: string, call: () => Promise<unknown>) {
    setBusy(id);
    await call().catch(() => undefined);
    setBusy(null);
    onChange();
  }

  return (
    <Card title="Pending invitations">
      <ul className="divide-y divide-zinc-100">
        {invitations.map((inv) => (
          <li key={inv.id} className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{inv.email}</p>
                <p className="text-xs text-zinc-500">
                  {ROLE_LABEL[inv.role]} · {inv.expired ? 'expired' : `expires in ${days(inv.expiresAt)} day(s)`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                loading={busy === `resend-${inv.id}`}
                onClick={() =>
                  run(`resend-${inv.id}`, async () => {
                    const result = await api<{ link: string }>(`/workspace/invitations/${inv.id}/resend`, { method: 'POST' });
                    setLink({ id: inv.id, link: result.link });
                  })
                }
              >
                Send again
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-700 hover:bg-rose-50"
                loading={busy === `revoke-${inv.id}`}
                onClick={() => run(`revoke-${inv.id}`, () => api(`/workspace/invitations/${inv.id}`, { method: 'DELETE' }))}
              >
                Cancel
              </Button>
            </div>
            {link?.id === inv.id && (
              <div className="mt-2">
                <CopyLink link={link.link} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MembersCard({
  members,
  myId,
  isOwner,
  canAssignDesks,
  desks,
  onChange,
  onLeft,
}: {
  members: Member[];
  myId: string;
  isOwner: boolean;
  canAssignDesks: boolean;
  desks: { id: string; name: string }[];
  onChange: () => void;
  onLeft: () => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function call(fn: () => Promise<unknown>, after: () => void) {
    setError('');
    try {
      await fn();
      after();
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <Card title="People" description={`${members.length} in this office`}>
      {error && (
        <Alert tone="error" className="mb-3">
          {error}
        </Alert>
      )}
      <ul className="divide-y divide-zinc-100">
        {members.map((m) => {
          const me = m.userId === myId;
          return (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
              <CharacterFace character={m.character} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.displayName} {me && <span className="text-zinc-500">(you)</span>}
                </p>
                <p className="truncate text-xs text-zinc-500">{m.email}</p>
              </div>
              {canAssignDesks ? (
                <select
                  aria-label={`Desk of ${m.displayName}`}
                  value={m.deskId ?? ''}
                  onChange={(e) =>
                    call(
                      () => api(`/workspace/members/${m.userId}/desk`, { method: 'PUT', body: { deskId: e.target.value || null } }),
                      onChange,
                    )
                  }
                  className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-sm"
                >
                  <option value="">No desk</option>
                  {desks.map((d) => {
                    const sitter = members.find((o) => o.deskId === d.id && o.userId !== m.userId);
                    return (
                      <option key={d.id} value={d.id}>
                        {d.name}
                        {sitter ? ` (swap with ${sitter.displayName.split(' ')[0]})` : ''}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <span className="text-xs text-zinc-500">{desks.find((d) => d.id === m.deskId)?.name ?? 'No desk'}</span>
              )}
              {isOwner && m.role !== 'OWNER' ? (
                <select
                  aria-label={`Role of ${m.displayName}`}
                  value={m.role}
                  onChange={(e) => call(() => api(`/workspace/members/${m.userId}`, { method: 'PATCH', body: { role: e.target.value } }), onChange)}
                  className="h-8 rounded-lg border border-zinc-200 bg-white px-2 text-sm"
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              ) : (
                <Badge tone={m.role === 'OWNER' ? 'success' : 'neutral'}>{ROLE_LABEL[m.role]}</Badge>
              )}
              {m.role !== 'OWNER' && (isOwner || me) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-700 hover:bg-rose-50"
                  onClick={() =>
                    confirming === m.userId
                      ? call(() => api(`/workspace/members/${m.userId}`, { method: 'DELETE' }), me ? onLeft : onChange)
                      : setConfirming(m.userId)
                  }
                  onBlur={() => setConfirming(null)}
                >
                  {confirming === m.userId ? 'Click to confirm' : me ? 'Leave' : 'Remove'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function OfficeCard({
  workspace,
  isOwner,
  onRenamed,
  onDeleted,
}: {
  workspace: MyWorkspace;
  isOwner: boolean;
  onRenamed: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(workspace.name);
  const [nameResult, setNameResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <Card title="Office settings">
      <form
        className="grid gap-3 sm:max-w-md sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy('rename');
          try {
            await api('/workspace', { method: 'PATCH', body: { name } });
            setNameResult({ tone: 'success', text: 'Saved.' });
            onRenamed();
          } catch (err) {
            setNameResult({ tone: 'error', text: message(err) });
          } finally {
            setBusy(null);
          }
        }}
      >
        <TextField label="Office name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="secondary" className="h-11" loading={busy === 'rename'}>
          Rename
        </Button>
      </form>
      {nameResult && (
        <p className={`mt-2 text-sm ${nameResult.tone === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{nameResult.text}</p>
      )}

      {isOwner && <TemplateSwitcher workspace={workspace} onSwitched={onRenamed} />}

      {isOwner && (
        <div className="mt-8 rounded-2xl p-4 ring-1 ring-rose-200">
          <h3 className="font-semibold text-rose-800">Delete the office</h3>
          <p className="mt-1 text-sm text-zinc-600">Everyone loses access, and the office, its furniture and invitations are gone for good.</p>
          <div className="mt-3 grid gap-3 sm:max-w-md sm:grid-cols-[1fr_auto] sm:items-end">
            <TextField
              label={`Type “${workspace.name}” to confirm`}
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              error={deleteError}
            />
            <Button
              className="h-11 bg-rose-700 hover:bg-rose-800"
              disabled={confirmName !== workspace.name}
              loading={busy === 'delete'}
              onClick={async () => {
                setBusy('delete');
                try {
                  await api('/workspace/delete', { body: { confirmName } });
                  onDeleted();
                } catch (err) {
                  setDeleteError(message(err));
                  setBusy(null);
                }
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

interface Template {
  id: string;
  name: string;
  description: string;
  maxTeam: number;
  layout: OfficeLayout;
}

/** Owner: move the office to another template, or back to the original furniture. */
function TemplateSwitcher({ workspace, onSwitched }: { workspace: MyWorkspace; onSwitched: () => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [picked, setPicked] = useState(workspace.templateId);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // The generated office is previewed as it would be made: for the people here now.
    const query = `team=${workspace.memberCount}&seed=${encodeURIComponent(workspace.name)}`;
    api<Template[]>(`/office/templates?${query}`).then(setTemplates, () => undefined);
  }, [workspace.memberCount, workspace.name]);

  const same = picked === workspace.templateId;
  const rebuild = same && picked === 'generated';
  const target = templates.find((t) => t.id === picked);
  const desks = target ? numberedDesks(target.layout).length : 0;
  const tooSmall = !!target && workspace.memberCount > desks;

  async function apply() {
    setBusy(true);
    setResult(null);
    try {
      await api('/workspace/template', { method: 'PUT', body: { templateId: picked, version: workspace.layoutVersion } });
      const text =
        picked === 'generated'
          ? `Your office is now made for ${workspace.memberCount} people.`
          : same
            ? 'The original furniture is back.'
            : `Your office is now ${target?.name}.`;
      setResult({ tone: 'success', text });
      setConfirming(false);
      onSwitched();
    } catch (err) {
      setResult({ tone: 'error', text: message(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <h3 className="font-semibold">Office layout</h3>
      <p className="mt-1 text-sm text-zinc-600">
        Move everyone to a bigger or smaller office, or start again from the original furniture. People in the office see
        the change at once; desks are handed out again.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label="Office layout">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={picked === t.id}
            onClick={() => {
              setPicked(t.id);
              setConfirming(false);
              setResult(null);
            }}
            className={cn(
              'overflow-hidden rounded-xl bg-white text-left ring-2 transition',
              picked === t.id ? 'ring-zinc-900' : 'ring-zinc-200 hover:ring-zinc-300',
            )}
          >
            <div className="bg-zinc-100 p-2">
              <LayoutPreview layout={t.layout} />
            </div>
            <div className="px-3 py-2">
              <p className="text-sm font-semibold">
                {t.name} {t.id === workspace.templateId && <span className="font-normal text-zinc-500">· now</span>}
              </p>
              <p className="text-xs text-zinc-500">{numberedDesks(t.layout).length} desks</p>
            </div>
          </button>
        ))}
      </div>
      {tooSmall && (
        <p className="mt-3 text-sm text-rose-700">
          {target?.name} has {desks} desks and your team has {workspace.memberCount} people.
        </p>
      )}
      {result && (
        <p className={`mt-3 text-sm ${result.tone === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{result.text}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!confirming ? (
          <Button variant="secondary" disabled={!target || tooSmall} onClick={() => setConfirming(true)}>
            {rebuild ? 'Make it again for your team' : same ? 'Reset to the original furniture' : `Move to ${target?.name ?? '…'}`}
          </Button>
        ) : (
          <>
            <span className="text-sm text-zinc-600">
              {same ? 'Your furniture changes will be lost.' : 'The current layout and its furniture will be replaced.'}
            </span>
            <Button loading={busy} onClick={apply}>
              Confirm
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
