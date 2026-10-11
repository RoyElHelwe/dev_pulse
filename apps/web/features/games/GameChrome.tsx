/**
 * Game chrome context and hook for game panel telemetry.
 * Enables active game panels to communicate player and spectator counts to the GameHost header.
 */

'use client';

import { createContext, useContext, useEffect } from 'react';

/**
 * Telemetry reported by an active game panel to the full-screen top navigation bar in GameHost.
 */
export interface GameChromeInfo {
  /** Seated / actively playing player count (null = unknown or hidden). */
  players?: number | null;
  /** Passive spectator count (null = unknown or hidden). */
  spectators?: number | null;
}

/**
 * React context providing the telemetry update callback to child game panels.
 */
export const GameChromeContext = createContext<((info: GameChromeInfo) => void) | null>(null);

/**
 * Hook invoked inside a game panel to publish live player and spectator counts to GameHost.
 *
 * @param info Current counts of players and spectators.
 */
export function useGameChromeInfo(info: GameChromeInfo): void {
  const set = useContext(GameChromeContext);
  const players = info.players ?? null;
  const spectators = info.spectators ?? null;

  // WHY: Dispatching to the parent setter inside useEffect avoids React's "Cannot update
  // a component while rendering a different component" warning during child panel render passes.
  useEffect(() => {
    set?.({ players, spectators });
  }, [set, players, spectators]);
}
