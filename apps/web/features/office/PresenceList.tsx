'use client';

import { Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { useAuth } from '@/features/auth/AuthProvider';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import type { Presence } from './connection';

/** "3 in the office" with their faces; click for the list. */
export function PresenceList({ people }: { people: Presence[] }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const count = people.length + 1; // + me
  return (
    <div ref={ref} className="relative">
      <Panel className="p-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex h-9 items-center gap-2 rounded-full px-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-900/5"
        >
          <span className="flex -space-x-2">
            {people.slice(0, 3).map((p) => (
              <CharacterFace key={p.id} character={p.character} className="size-6 ring-2 ring-white" />
            ))}
            {people.length === 0 && <Users className="size-4" aria-hidden="true" />}
          </span>
          {count}
          <span className="-ml-1 hidden md:inline">in the office</span>
        </button>
      </Panel>
      {open && (
        <Panel className="absolute right-0 z-20 mt-2 w-60 p-1.5">
          <ul>
            <li className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm">
              <span className="size-2 rounded-full bg-emerald-500" />
              {user?.displayName} <span className="text-zinc-500">(you)</span>
            </li>
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm">
                <CharacterFace character={p.character} className="size-6" />
                {p.name}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
