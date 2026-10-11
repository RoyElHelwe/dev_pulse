/**
 * Shared type definitions for the interactive office games system.
 * Defines supported game kinds, common panel properties, and leaderboard data structures.
 */

import type { Socket } from 'socket.io-client';

/** Supported interactive office game types rendered within the game host overlay. */
export type GameKind = 'foosball' | 'uno' | 'lego';

/**
 * Common props passed by GameHost into dynamically rendered game panels.
 */
export interface GamePanelProps {
  /** Target furniture object ID in the workspace layout. */
  objectId: string;
  /** Display name of the game object. */
  name: string;
  /** Connected socket.io client instance for real-time game traffic. */
  socket: Socket;
  /** Current authenticated user information and avatar character. */
  me: { id: string; name: string; character: string };
  /** Callback to close the game modal and leave the game session. */
  onClose: () => void;
}

/** Single player statistics entry in a game leaderboard ranking. */
export interface LeaderboardEntry {
  userId: string;
  name: string;
  character: string;
  wins: number;
  losses: number;
  games: number;
}

/** Response payload returned by the `/workspace/games/leaderboard` API endpoint. */
export interface LeaderboardResponse {
  game: GameKind;
  days: number;
  entries: LeaderboardEntry[];
}
