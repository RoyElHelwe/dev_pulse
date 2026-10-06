import type { Socket } from 'socket.io-client';

export type GameKind = 'foosball' | 'uno' | 'lego';

export interface GamePanelProps {
  objectId: string;
  name: string;
  socket: Socket;
  me: { id: string; name: string; character: string };
  onClose: () => void;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  character: string;
  wins: number;
  losses: number;
  games: number;
}

export interface LeaderboardResponse {
  game: GameKind;
  days: number;
  entries: LeaderboardEntry[];
}
