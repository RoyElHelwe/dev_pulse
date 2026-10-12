/**
 * Opponents row component for active Uno matches.
 * Displays seated opponents and players at the Uno table with active turn and UNO call badges.
 */

'use client';

import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { cn } from '@/lib/cn';
import type { UnoView } from './types';

interface UnoOpponentsProps {
  players: UnoView['players'];
  meId: string;
  turnId: string | null;
  isPlayer: boolean;
}

/**
 * Renders seated players around the table with card counts and status indicators.
 */
export function UnoOpponents({ players, meId, turnId, isPlayer }: UnoOpponentsProps) {
  const visiblePlayers = isPlayer ? players.filter((p) => p.id !== meId) : players;

  return (
    <div className="flex flex-col gap-1 shrink-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 px-1">
        {isPlayer ? 'Opponents' : 'Players'}
      </span>
      <div className="flex flex-wrap gap-2">
        {visiblePlayers.map((p) => {
          const isCurrentTurn = p.id === turnId;
          return (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-2 shadow-2xs transition-all',
                isCurrentTurn
                  ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                  : 'border-zinc-200 bg-zinc-50/50',
              )}
            >
              <CharacterFace character={p.character} className="size-6 shrink-0" />
              <div className="flex flex-col">
                <span className="max-w-[90px] truncate text-xs font-semibold text-zinc-800">
                  {p.name}
                </span>
                <span className="text-[11px] text-zinc-500">
                  {p.cards} {p.cards === 1 ? 'card' : 'cards'}
                </span>
              </div>
              {isCurrentTurn && (
                <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                  Turn
                </span>
              )}
              {p.saidUno && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-xs animate-bounce">
                  UNO!
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
