/**
 * Type definitions for the Uno game interface and view model.
 * Describes card attributes, round state, and synchronization structures.
 */

/** Valid standard colors for Uno cards and game active states. */
export type Color = 'red' | 'yellow' | 'green' | 'blue';

/** Card face values including numbers and special actions. */
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

/** Single Uno card representation. */
export interface Card {
  id: number;
  color: Color | 'wild';
  value: Value;
}

interface UnoPlayer {
  id: string;
  name: string;
  character: string;
  cards: number;
  saidUno: boolean;
}

interface UnoSpectator {
  id: string;
  name: string;
}

/** Complete Uno game state view synchronized from the server. */
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
