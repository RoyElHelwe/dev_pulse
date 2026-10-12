/**
 * Uno game container and screen router.
 * Connects to the game session socket and delegates rendering to lobby, table, or ended screens.
 */

'use client';

import { useGameChromeInfo } from '../GameChrome';
import type { GamePanelProps } from '../types';
import { useGameSession } from '../useGameSession';
import type { UnoView } from './types';
import { UnoEnded } from './UnoEnded';
import { UnoLobby } from './UnoLobby';
import { UnoTable } from './UnoTable';

/**
 * Root game panel for Uno, managing session lifecycle and screen selection.
 */
export default function UnoPanel({ objectId, socket, me }: GamePanelProps) {
  const { state, status, error, send } = useGameSession<UnoView>(socket, 'uno', objectId);

  useGameChromeInfo({
    players: state ? state.players.length : null,
    spectators: state?.spectators && state.spectators.length > 0 ? state.spectators.length : null,
  });

  const isHost = Boolean(state?.hostId === me.id);
  const winner = state?.players.find((p) => p.id === state.winnerId);

  return (
    <div
      data-captures-keys=""
      className="flex h-full w-full min-h-0 flex-col p-3 sm:p-4 text-zinc-900 select-none overflow-hidden"
    >
      {/* Action / Session Error (non-fatal) */}
      {error && (
        <div className="shrink-0 mb-2 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error.message || 'An error occurred'}
        </div>
      )}

      {/* Loading / Disconnected / Stub / Left States */}
      {status === 'joining' && !state && (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center text-sm text-zinc-500">
          <span className="size-5 animate-spin rounded-full border-2 border-zinc-400 border-r-transparent mb-2" />
          Joining Uno table...
        </div>
      )}

      {status === 'left' && (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center text-sm text-zinc-500">
          You left the Uno table.
        </div>
      )}

      {status === 'error' && !state && (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center rounded-xl border border-dashed border-red-200 bg-red-50/50 p-8 text-center text-sm text-red-600">
          {error?.message || 'Error connecting to Uno table.'}
        </div>
      )}

      {state && !state.phase && (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center text-sm text-zinc-500">
          Waiting for game state...
        </div>
      )}

      {/* LOBBY PHASE */}
      {state?.phase === 'lobby' && (
        <UnoLobby
          players={state.players}
          spectators={state.spectators}
          hostId={state.hostId}
          myId={me.id}
          isHost={isHost}
          onStart={() => send({ type: 'start' })}
        />
      )}

      {/* PLAYING PHASE */}
      {state?.phase === 'playing' && (
        <UnoTable
          state={state}
          meId={me.id}
          onSend={send}
        />
      )}

      {/* ENDED PHASE */}
      {state?.phase === 'ended' && (
        <UnoEnded
          winner={winner}
          winnerId={state.winnerId}
          myId={me.id}
          isHost={isHost}
          log={state.log}
          onPlayAgain={() => send({ type: 'again' })}
        />
      )}
    </div>
  );
}
