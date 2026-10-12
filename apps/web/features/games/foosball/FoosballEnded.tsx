'use client';

/**
 * Match-ended overlay screen for Foosball.
 * Announces the winning side or draw, forfeit status, and provides the rematch action.
 */

import { Button } from '@/components/ui/Button';
import type { FoosballSide } from './constants';

/** Outcome score, winning side, forfeit status, and rematch callback to render the match completion overlay. */
export interface FoosballEndedProps {
  winner: FoosballSide | null;
  score: { A: number; B: number };
  forfeit: boolean;
  onRematch?: () => void;
}

/**
 * Overlay presented over the foosball table when a match concludes.
 */
export function FoosballEnded({
  winner,
  score,
  forfeit,
  onRematch,
}: FoosballEndedProps) {
  return (
    <div
      data-testid="foosball-ended-overlay"
      className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="flex flex-col items-center rounded-xl border border-zinc-700 bg-zinc-900/95 p-5 text-center shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
          Match Ended
        </div>
        <div className="text-xl font-bold text-white mb-1">
          {winner === 'A' ? 'Team Left (Blue)' : winner === 'B' ? 'Team Right (Red)' : 'Draw'} Won!
        </div>
        {forfeit && <span className="text-xs text-amber-400 font-medium mb-3">Won by forfeit</span>}
        <div className="font-mono text-sm text-zinc-300 mb-4">
          Final: {score.A} - {score.B}
        </div>
        {onRematch && (
          <Button variant="primary" size="sm" onClick={onRematch}>
            Rematch
          </Button>
        )}
      </div>
    </div>
  );
}
