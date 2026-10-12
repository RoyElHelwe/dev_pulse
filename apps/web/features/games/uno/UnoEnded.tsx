/**
 * Game ended / results screen for Uno.
 * Shows the winner announcement banner, rematch controls, and final game log.
 */

'use client';

import { Button } from '@/components/ui/Button';
import type { UnoView } from './types';

interface UnoEndedProps {
  winner?: UnoView['players'][number];
  winnerId: string | null;
  myId: string;
  isHost: boolean;
  log: string[];
  onPlayAgain: () => void;
}

/**
 * Displays match outcome and final standings after a game finishes.
 */
export function UnoEnded({
  winner,
  winnerId,
  myId,
  isHost,
  log,
  onPlayAgain,
}: UnoEndedProps) {
  return (
    <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 overflow-y-auto">
      <div
        data-testid="uno-winner"
        aria-label="Winner banner"
        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-6 text-center max-w-md w-full"
      >
        <div className="text-3xl">🏆</div>
        <div className="text-base font-bold text-zinc-900">
          {winnerId === myId
            ? 'You won the game!'
            : `${winner ? winner.name : 'Unknown player'} won the game!`}
        </div>
        <p className="text-xs text-zinc-600">
          The game has ended.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-2 pt-2">
        {isHost ? (
          <Button
            data-testid="uno-again"
            aria-label="Play again"
            variant="primary"
            size="md"
            onClick={onPlayAgain}
          >
            Play again
          </Button>
        ) : (
          <span className="text-sm italic text-zinc-500">
            Waiting for host to start another game...
          </span>
        )}
      </div>

      {log && log.length > 0 && (
        <div className="w-full max-w-md rounded-xl border border-zinc-200/80 bg-zinc-50 p-2.5 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Final Game Log
          </span>
          <div className="flex flex-col gap-0.5 max-h-20 overflow-y-auto font-mono text-[11px] text-zinc-600">
            {log.map((line, idx) => (
              <div key={idx} className="truncate">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
