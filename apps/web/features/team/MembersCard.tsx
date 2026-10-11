// Card displaying current workspace members, desk assignments, and role controls.
// Rendered on the team settings page for all members with managerial actions for owners.

'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { ROLE_LABEL } from '@/features/workspace/types';
import { api } from '@/lib/api';
import { getErrorMessage, type Member } from './teamHelpers';

interface DeskOption {
  id: string;
  name: string;
}

interface MembersCardProps {
  members: Member[];
  myId: string;
  isOwner: boolean;
  canAssignDesks: boolean;
  desks: DeskOption[];
  onChange: () => void;
  onLeft: () => void;
}

/** Card listing office members with desk selection, role changing, and member removal. */
export function MembersCard({
  members,
  myId,
  isOwner,
  canAssignDesks,
  desks,
  onChange,
  onLeft,
}: MembersCardProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function call(fn: () => Promise<unknown>, after: () => void) {
    setError('');
    try {
      await fn();
      after();
    } catch (err) {
      setError(getErrorMessage(err));
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
