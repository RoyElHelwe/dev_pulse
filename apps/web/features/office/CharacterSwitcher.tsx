'use client';

import { useEffect, useRef, useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { CharacterGrid } from '@/features/workspace/CharacterGrid';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

const STATUS_PRESETS = ['Focusing', 'In a meeting', 'On break ☕', 'Back soon'];

/** "You" chip in the office: pick another character or set a status (everyone sees both, live). */
export function CharacterSwitcher({ name, character, status }: { name: string; character: string; status: string | null }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function saveStatus(next: string) {
    setSaving('status');
    await api('/workspace/me', { method: 'PATCH', body: { status: next } }).catch(() => undefined);
    setSaving(null);
  }

  async function pick(key: string) {
    setSaving(key);
    // The office socket sends the change back to everyone, including this tab.
    await api('/workspace/me', { method: 'PATCH', body: { character: key } }).catch(() => undefined);
    setSaving(null);
    setOpen(false);
  }

  return (
    <div ref={ref} className="absolute bottom-5 left-4">
      {open && (
        <Panel className="absolute bottom-full mb-2 w-72 p-3">
          <p className="px-1 pb-2 text-sm font-semibold">Your character</p>
          <CharacterGrid value={character} onPick={pick} disabled={saving !== null} />
          <p className="px-1 pt-4 pb-2 text-sm font-semibold">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={status === preset}
                disabled={saving !== null}
                onClick={() => saveStatus(status === preset ? '' : preset)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-60',
                  status === preset
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('status') as HTMLInputElement;
              void saveStatus(input.value.trim());
            }}
          >
            <input
              key={status ?? ''}
              name="status"
              defaultValue={status && !STATUS_PRESETS.includes(status) ? status : ''}
              maxLength={40}
              placeholder="Your own status…"
              aria-label="Custom status"
              className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              type="submit"
              disabled={saving !== null}
              className="rounded-lg bg-zinc-900 px-2.5 text-xs font-medium text-white disabled:opacity-60"
            >
              Set
            </button>
            {status && (
              <button
                type="button"
                onClick={() => saveStatus('')}
                className="rounded-lg px-2 text-xs text-zinc-500 hover:bg-zinc-900/5"
              >
                Clear
              </button>
            )}
          </form>
        </Panel>
      )}
      <Panel className="p-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-medium transition hover:bg-zinc-900/5"
        >
          <CharacterFace character={character} className="size-7" />
          <span className="flex flex-col items-start leading-tight">
            <span className="max-w-32 truncate">{name}</span>
            {status && <span className="max-w-32 truncate text-[11px] font-normal text-zinc-500">{status}</span>}
          </span>
          <span className="text-xs font-normal text-zinc-500">Change</span>
        </button>
      </Panel>
    </div>
  );
}
