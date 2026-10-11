// Main team settings view composing member cards, invitations, and office settings.
// Mounted at the /team route for signed-in workspace members.

'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { canManage, type MyWorkspace } from '@/features/workspace/types';
import { numberedDesks } from '@/game/layout/derive';
import { api } from '@/lib/api';
import { InviteCard } from './InviteCard';
import { InvitationsCard } from './InvitationsCard';
import { MembersCard } from './MembersCard';
import { OfficeCard } from './OfficeCard';
import type { Member, PendingInvitation } from './teamHelpers';

/** Team page allowing members to inspect coworkers, assign desks, invite teammates, and manage the office. */
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
          onRenamed={(ws) => {
            if (ws) setWorkspace(ws);
            void load();
          }}
          onDeleted={async () => {
            await reloadUser();
            router.replace('/onboarding?notice=deleted');
          }}
        />
      )}
    </div>
  );
}
