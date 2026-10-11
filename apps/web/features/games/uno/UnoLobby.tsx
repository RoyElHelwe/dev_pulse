/**
 * Uno lobby screen component.
 * Displays seated players, waiting spectators, and start controls for the room host.
 */

'use client';

import { Crown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { MAX_SEATED_PLAYERS, MIN_PLAYERS_TO_START } from './constants';
import type { UnoView } from './types';

interface UnoLobbyProps {
  players: UnoView['players'];
  spectators: UnoView['spectators'];
  hostId: string | null;
  myId: string;
  isHost: boolean;
  onStart: () => void;
}

interface PlayerCardListProps {
  players: UnoView['players'];
  hostId: string | null;
  myId: string;
}

function PlayerCardList({ players, hostId, myId }: PlayerCardListProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {players.map((player) => (
        <div
          key={player.id}
          className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2.5 shadow-2xs"
        >
          <CharacterFace character={player.character} className="size-8 shrink-0" />
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate">
              <span className="truncate text-sm font-medium text-zinc-900">{player.name}</span>
              {player.id === myId && (
                <span className="text-xs text-zinc-400">(You)</span>
              )}
            </div>
          </div>
          {player.id === hostId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200/60">
              <Crown className="size-3" />
              Host
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Displays the pre-game lobby with player roster and start controls.
 */
export function UnoLobby({
  players,
  spectators,
  hostId,
  myId,
  isHost,
  onStart,
}: UnoLobbyProps) {
  return (
    <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Seated Players ({players.length}/{MAX_SEATED_PLAYERS})
          </span>
        </div>

        <PlayerCardList players={players} hostId={hostId} myId={myId} />

        {spectators && spectators.length > 0 && (
          <div className="mt-4 border-t border-zinc-200 pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Spectators ({spectators.length})
            </span>
            <p className="mt-1 text-xs text-zinc-600">
              {spectators.map((s) => s.name).join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Lobby Actions */}
      <div className="flex flex-col items-center justify-center gap-2 pt-2">
        {isHost ? (
          <>
            <Button
              data-testid="uno-start"
              aria-label="Start game"
              variant="primary"
              size="md"
              disabled={players.length < MIN_PLAYERS_TO_START}
              onClick={onStart}
            >
              Start game
            </Button>
            {players.length < MIN_PLAYERS_TO_START && (
              <span className="text-xs text-zinc-400">At least 2 players needed to start</span>
            )}
          </>
        ) : (
          <span className="text-sm italic text-zinc-500">Waiting for host to start...</span>
        )}
      </div>
    </div>
  );
}
