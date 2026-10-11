/**
 * Header navigation bar for the GameHost modal.
 * Displays active game title, live player/spectator counts, leaderboard toggle, and close controls.
 */

'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import type { GameChromeInfo } from './GameChrome';
import { Leaderboard } from './Leaderboard';
import type { GameKind } from './types';

/** Props for the GameHostHeader component. */
export interface GameHostHeaderProps {
  /** Name of the active game object. */
  name: string;
  /** Kind of active game (foosball, uno, lego). */
  gameKind: GameKind;
  /** Live participant telemetry (seated players, spectators). */
  chromeInfo: GameChromeInfo;
  /** Socket instance for real-time leaderboard match updates. */
  /** Whether the floating leaderboard popover is currently expanded. */
  leaderboardOpen: boolean;
  /** Toggle callback to open or close the leaderboard popover. */
  onToggleLeaderboard: () => void;
  /** Callback to leave and close the game session. */
  onClose: () => void;
}

/**
 * Top chrome bar rendered at the top of the full-screen GameHost overlay.
 */
export function GameHostHeader({
  name,
  gameKind,
  chromeInfo,
  leaderboardOpen,
  onToggleLeaderboard,
  onClose,
}: GameHostHeaderProps) {
  return (
    <header className="relative flex h-11 shrink-0 items-center justify-between border-b border-zinc-200/80 bg-white px-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <h2 className="text-sm font-semibold text-zinc-900 truncate">{name}</h2>
        {chromeInfo.players != null && (
          <span
            data-testid="game-chrome-players"
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 shrink-0"
          >
            {chromeInfo.players} playing
          </span>
        )}
        {chromeInfo.spectators != null && (
          <span
            data-testid="game-chrome-spectators"
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 shrink-0"
          >
            {chromeInfo.spectators} watching
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          data-testid="game-leaderboard-toggle"
          aria-pressed={leaderboardOpen}
          variant="secondary"
          size="sm"
          onClick={onToggleLeaderboard}
        >
          Leaderboard
        </Button>
        <Button
          data-testid="game-leave"
          variant="secondary"
          size="sm"
          onClick={onClose}
        >
          Leave
        </Button>
        <IconButton aria-label="Close game" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>

      {leaderboardOpen && (
        <Leaderboard
          game={gameKind}
          className="absolute top-12 right-4 z-50 w-80 shadow-xl max-h-[70vh] overflow-auto bg-white"
        />
      )}
    </header>
  );
}
