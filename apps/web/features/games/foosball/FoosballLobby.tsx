'use client';

/**
 * Lobby and match setup screen for Foosball.
 * Displays team seating boxes, player rosters, and match start/rematch controls.
 */

import { Button } from '@/components/ui/Button';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { cn } from '@/lib/cn';
import type { FoosballPhase, FoosballPlayer, FoosballSide } from './constants';

/** Maximum number of players seated on each side (2v2 maximum). */
const MAX_PLAYERS_PER_TEAM = 2;

interface TeamBoxProps {
  side: FoosballSide;
  players: FoosballPlayer[];
  myId: string;
  isLobby: boolean;
  isMySide: boolean;
  canSit: boolean;
  onSit: (side: FoosballSide) => void;
  onStand: () => void;
}

/** Renders a team's roster, seating capacity, and Sit/Stand actions. */
function TeamBox({
  side,
  players,
  myId,
  isLobby,
  isMySide,
  canSit,
  onSit,
  onStand,
}: TeamBoxProps) {
  const isA = side === 'A';
  return (
    <div className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-2 sm:p-2.5 text-xs">
      <div className="flex items-center justify-between gap-1 mb-1">
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold',
            isA ? 'text-blue-700' : 'text-red-700',
          )}
        >
          <span className={cn('size-2 rounded-full', isA ? 'bg-blue-600' : 'bg-red-600')} />
          {isA ? 'Team Left' : 'Team Right'}
        </span>
        <span className="text-[11px] font-medium text-zinc-400">
          {players.length}/{MAX_PLAYERS_PER_TEAM} seated
        </span>
      </div>

      <div className="flex items-center gap-1.5 min-h-[30px] py-0.5 overflow-x-auto">
        {players.length === 0 ? (
          <span className="text-xs italic text-zinc-400">No players seated</span>
        ) : (
          players.map((player) => (
            <div
              key={player.userId}
              className="flex items-center gap-1.5 rounded-md border border-zinc-200/60 bg-white px-2 py-1 text-xs shadow-2xs shrink-0"
            >
              <CharacterFace character={player.character} className="size-4 shrink-0" />
              <span className="max-w-[85px] truncate font-medium text-zinc-800">
                {player.name}
              </span>
              {player.userId === myId && (
                <span
                  className={cn(
                    'text-[10px] font-semibold',
                    isA ? 'text-blue-600' : 'text-red-600',
                  )}
                >
                  (You)
                </span>
              )}
              {player.away && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1 rounded">
                  away
                </span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-1 pt-1 border-t border-zinc-200/60 flex justify-end">
        {isMySide ? (
          <Button
            variant="secondary"
            size="sm"
            className="h-7 px-2.5 text-xs"
            disabled={!isLobby}
            onClick={onStand}
          >
            Stand up
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="h-7 px-2.5 text-xs"
            data-testid={`foosball-sit-${side}`}
            disabled={!isLobby || !canSit}
            onClick={() => onSit(side)}
          >
            {isA ? 'Sit Left' : 'Sit Right'}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Player roster per side, current user seat assignment, match phase, and lobby action callbacks. */
export interface FoosballLobbyProps {
  phase: FoosballPhase;
  seatsA: FoosballPlayer[];
  seatsB: FoosballPlayer[];
  myId: string;
  youSide: FoosballSide | null;
  canStart: boolean;
  startHint: string;
  onSit: (side: FoosballSide) => void;
  onStand: () => void;
  onStart: () => void;
  onRematch: () => void;
}

/**
 * Top lobby screen bar containing both team seating boxes and central match start / rematch controls.
 */
export function FoosballLobby({
  phase,
  seatsA,
  seatsB,
  myId,
  youSide,
  canStart,
  startHint,
  onSit,
  onStand,
  onStart,
  onRematch,
}: FoosballLobbyProps) {
  const isLobbyOrEnded = phase === 'lobby' || phase === 'ended';
  const youSeated = Boolean(youSide);

  return (
    <div className="shrink-0 mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <TeamBox
        side="A"
        players={seatsA}
        myId={myId}
        isLobby={isLobbyOrEnded}
        isMySide={youSide === 'A'}
        canSit={!youSeated && seatsA.length < MAX_PLAYERS_PER_TEAM}
        onSit={onSit}
        onStand={onStand}
      />

      <div className="flex flex-col items-center justify-center gap-1 shrink-0 px-2 text-center min-w-[140px]">
        {phase === 'lobby' && (
          <>
            <Button
              variant="primary"
              size="sm"
              data-testid="foosball-start"
              disabled={!canStart}
              onClick={onStart}
            >
              Start match
            </Button>
            {startHint && (
              <span className="text-[11px] text-zinc-500 max-w-[180px] leading-tight">
                {startHint}
              </span>
            )}
          </>
        )}

        {phase === 'ended' && youSeated && (
          <Button variant="primary" size="sm" onClick={onRematch}>
            Rematch
          </Button>
        )}
      </div>

      <TeamBox
        side="B"
        players={seatsB}
        myId={myId}
        isLobby={isLobbyOrEnded}
        isMySide={youSide === 'B'}
        canSit={!youSeated && seatsB.length < MAX_PLAYERS_PER_TEAM}
        onSit={onSit}
        onStand={onStand}
      />
    </div>
  );
}
