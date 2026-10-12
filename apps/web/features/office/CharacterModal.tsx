/**
 * Character customization dialog in the office view.
 * Enables editing the player avatar and updates workspace state on save.
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { CharacterStudio } from '@/features/workspace/CharacterStudio';
import { api } from '@/lib/api';

/** Display visibility, dismiss handler, and active character sprite identifier for the customization dialog. */
export interface CharacterModalProps {
  open: boolean;
  onClose: () => void;
  character: string;
}

/** Renders a modal dialog to preview and edit the player's character avatar. */
export function CharacterModal({ open, onClose, character }: CharacterModalProps) {
  const [draft, setDraft] = useState(character);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(character);
      setSaving(false);
    }
  }, [open, character]);

  async function handleSave() {
    setSaving(true);
    // The office socket sends the change back to everyone, including this tab.
    await api('/workspace/me', { method: 'PATCH', body: { character: draft } }).catch(() => undefined);
    setSaving(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Your character" className="max-w-2xl">
      <div className="mt-4">
        <CharacterStudio value={draft} onChange={setDraft} disabled={saving} />
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" loading={saving} disabled={saving} onClick={handleSave}>
          Save
        </Button>
      </div>
    </Modal>
  );
}
