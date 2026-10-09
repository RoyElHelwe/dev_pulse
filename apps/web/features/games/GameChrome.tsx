'use client';

import { createContext, useContext, useEffect } from 'react';

/** What a game panel reports to the full-screen top bar rendered by GameHost. */
export interface GameChromeInfo {
  /** Seated / playing people (null = unknown, hidden). */
  players?: number | null;
  /** Watching people (null = unknown, hidden). */
  spectators?: number | null;
}

export const GameChromeContext = createContext<((info: GameChromeInfo) => void) | null>(null);

/** Call from a game panel on every render with the current counts; GameHost shows them in its top bar. */
export function useGameChromeInfo(info: GameChromeInfo): void {
  const set = useContext(GameChromeContext);
  const players = info.players ?? null;
  const spectators = info.spectators ?? null;
  useEffect(() => {
    set?.({ players, spectators });
  }, [set, players, spectators]);
}
