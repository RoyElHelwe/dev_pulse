'use client';

import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { useEscape } from '@/lib/escape';

/** E at a free desk: asks before moving your seat there (E again confirms, Esc cancels). */
export function MoveDeskPrompt({
  name,
  hasDesk,
  busy,
  onMove,
  onCancel,
}: {
  name: string;
  hasDesk: boolean;
  busy: boolean;
  onMove: () => void;
  onCancel: () => void;
}) {
  useEscape(true, onCancel);
  return (
    <Panel role="alertdialog" aria-label={`Move to ${name}`} className="absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-3 py-2 pr-2 pl-4">
      <span className="text-sm font-medium text-zinc-700">
        {hasDesk ? `Make ${name} your desk?` : `Take ${name}?`}
      </span>
      <Button size="sm" loading={busy} onClick={onMove}>
        Move here
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
    </Panel>
  );
}
