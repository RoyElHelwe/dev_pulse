'use client';

import { HeadphoneOff, MicOff, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Panel } from '@/components/ui/Panel';
import { useAuth } from '@/features/auth/AuthProvider';
import { useVoiceStates, type VoiceState } from '@/features/voice/store';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import type { Presence } from './connection';

interface PresenceListProps {
  people: Presence[];
  /** "Atlas · Meeting room" for a zone id, or null for the open space. */
  placeOf(zone: string | null | undefined): string | null;
  myZone: string | null;
  myStatus: string | null;
  /** People close enough to talk (player:near). */
  nearby: Set<string>;
}

/** "3 in the office" with their faces; click for the list (where everyone is, their status). */
export function PresenceList({ people, placeOf, myZone, myStatus, nearby }: PresenceListProps) {
  const { user } = useAuth();
  const voice = useVoiceStates();
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
        <Panel className="absolute right-0 z-20 mt-2 max-h-[70vh] w-72 overflow-y-auto p-1.5">
          <ul>
            <Person
              name={user?.displayName ?? ''}
              you
              place={placeOf(myZone)}
              status={myStatus}
              voice={user ? voice.get(user.id) : undefined}
            />
            {people.map((p) => (
              <Person
                key={p.id}
                name={p.name}
                character={p.character}
                place={placeOf(p.zone)}
                status={p.status}
                near={nearby.has(p.id)}
                voice={voice.get(p.id)}
              />
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function Person(props: {
  name: string;
  character?: string;
  you?: boolean;
  place: string | null;
  status: string | null;
  near?: boolean;
  /** In voice: muted or deafened shows an icon. */
  voice?: VoiceState;
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm">
      {props.character ? (
        <CharacterFace character={props.character} className="size-7 shrink-0" />
      ) : (
        <span className="mx-2.5 size-2 shrink-0 rounded-full bg-emerald-500" />
      )}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate">
          {props.name} {props.you && <span className="text-zinc-500">(you)</span>}
        </span>
        <span className="block truncate text-xs text-zinc-500">
          {props.place ?? 'Open space'}
          {props.status && <> · {props.status}</>}
        </span>
      </span>
      {props.voice?.deafened ? (
        <HeadphoneOff className="size-3.5 shrink-0 text-rose-500" aria-label="Deafened" role="img" />
      ) : (
        props.voice?.muted && <MicOff className="size-3.5 shrink-0 text-rose-500" aria-label="Muted" role="img" />
      )}
      {props.near && (
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Nearby</span>
      )}
    </li>
  );
}
