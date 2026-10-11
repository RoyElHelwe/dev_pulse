// Card for workspace office settings, renaming, expanding wings, switching templates, and deletion.
// Rendered on the team settings page for workspace managers and owners.

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import type { MyWorkspace } from '@/features/workspace/types';
import { api } from '@/lib/api';
import { ExpandOfficeCard } from './ExpandOfficeCard';
import { TemplateSwitcher } from './TemplateSwitcher';
import { getErrorMessage } from './teamHelpers';

/** Maximum allowed character length for the office name. */
const MAX_OFFICE_NAME_LENGTH = 40;

interface OfficeCardProps {
  workspace: MyWorkspace;
  isOwner: boolean;
  onRenamed: (workspace?: MyWorkspace) => void;
  onDeleted: () => void;
}

/** Card containing office configuration including renaming, layout updates, wings, and deletion. */
export function OfficeCard({
  workspace,
  isOwner,
  onRenamed,
  onDeleted,
}: OfficeCardProps) {
  const [name, setName] = useState(workspace.name);
  const [nameResult, setNameResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [chillAdded, setChillAdded] = useState(false);

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
            setNameResult({ tone: 'error', text: getErrorMessage(err) });
          } finally {
            setBusy(null);
          }
        }}
      >
        <TextField
          label="Office name"
          value={name}
          maxLength={MAX_OFFICE_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" variant="secondary" className="h-11" loading={busy === 'rename'}>
          Rename
        </Button>
      </form>
      {nameResult && (
        <p className={`mt-2 text-sm ${nameResult.tone === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>{nameResult.text}</p>
      )}

      {(workspace.canExpand || workspace.canAddChill) && (
        <ExpandOfficeCard
          workspace={workspace}
          onExpanded={onRenamed}
          onChillAdded={() => setChillAdded(true)}
        />
      )}

      {chillAdded && (
        <p role="status" data-testid="chill-added" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          Chill room added
        </p>
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
                  setDeleteError(getErrorMessage(err));
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
