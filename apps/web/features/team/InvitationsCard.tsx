// Card listing pending invitations with actions to resend or cancel them.
// Rendered on the team settings page for workspace managers.

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ROLE_LABEL } from '@/features/workspace/types';
import { api } from '@/lib/api';
import { CopyLink } from './CopyLink';
import { daysUntil, type PendingInvitation } from './teamHelpers';

interface InvitationsCardProps {
  invitations: PendingInvitation[];
  onChange: () => void;
}

/** Card displaying active pending invitations with resend and revoke controls. */
export function InvitationsCard({ invitations, onChange }: InvitationsCardProps) {
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
                  {ROLE_LABEL[inv.role]} · {inv.expired ? 'expired' : `expires in ${daysUntil(inv.expiresAt)} day(s)`}
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
