export type Color = 'red' | 'yellow' | 'green' | 'blue';

export type Value =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'wild'
  | 'wild4';

export interface Card {
  id: number;
  color: Color | 'wild';
  value: Value;
}

export interface UnoPlayer {
  id: string;
  name: string;
  character: string;
  cards: number;
  saidUno: boolean;
}

export interface UnoSpectator {
  id: string;
  name: string;
}

export interface UnoView {
  phase: 'lobby' | 'playing' | 'ended';
  hostId: string | null;
  role: 'player' | 'spectator';
  hand: Card[];
  players: UnoPlayer[];
  spectators: UnoSpectator[];
  turnId: string | null;
  direction: 1 | -1;
  top: Card | null;
  currentColor: Color | null;
  drawPile: number;
  pendingDraw: number;
  pendingKind: 'draw2' | 'draw4' | null;
  drewCardId: number | null;
  playable: number[];
  vulnerableId: string | null;
  winnerId: string | null;
  log: string[];
}

export type UnoAction =
  | { type: 'start' }
  | { type: 'again' }
  | { type: 'play'; cardId: number; color?: Color }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'uno' }
  | { type: 'catch' };
