// Component for switching workspace office layouts or resetting layout furniture.
// Rendered within the office settings card on the team page.

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { LayoutPreview } from '@/features/workspace/LayoutPreview';
import type { MyWorkspace } from '@/features/workspace/types';
import { numberedDesks } from '@/game/layout/geometry';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { getErrorMessage, type OfficeTemplate } from './teamHelpers';

interface TemplateSwitcherProps {
  workspace: MyWorkspace;
  onSwitched: () => void;
}

/** Layout picker and switcher for changing or resetting the workspace office template. */
export function TemplateSwitcher({ workspace, onSwitched }: TemplateSwitcherProps) {
  const [templates, setTemplates] = useState<OfficeTemplate[]>([]);
  const [picked, setPicked] = useState(workspace.templateId);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // The generated office is previewed as it would be made: for the people here now.
  const seed = workspace.layout.generated?.seed ?? workspace.name;
  useEffect(() => {
    let cancelled = false;
    const query = `team=${workspace.memberCount}&seed=${encodeURIComponent(seed)}`;
    api<OfficeTemplate[]>(`/office/templates?${query}`).then(
      (list) => !cancelled && setTemplates(list),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [workspace.memberCount, seed]);

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
      setResult({ tone: 'error', text: getErrorMessage(err) });
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
