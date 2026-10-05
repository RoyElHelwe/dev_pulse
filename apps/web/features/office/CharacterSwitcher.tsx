'use client';

import { useEffect, useRef, useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { CharacterFace, CharacterPreview } from '@/features/workspace/CharacterPreview';
import { LOOK_KEYS } from '@/game/objects/looks';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

/** "You" chip in the office; click to pick another character (everyone sees it change). */
export function CharacterSwitcher({ name, character }: { name: string; character: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

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
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Character">
            {LOOK_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={character === key}
                aria-label={key}
                disabled={saving !== null}
                onClick={() => pick(key)}
                className={cn(
                  'rounded-xl bg-zinc-50 p-1.5 ring-2 transition disabled:opacity-60',
                  character === key ? 'bg-emerald-50 ring-emerald-500' : 'ring-transparent hover:ring-zinc-300',
                )}
              >
                <CharacterPreview character={key} className="mx-auto h-12" />
              </button>
            ))}
          </div>
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
          <span className="max-w-32 truncate">{name}</span>
          <span className="text-xs font-normal text-zinc-500">Change</span>
        </button>
      </Panel>
    </div>
  );
}
