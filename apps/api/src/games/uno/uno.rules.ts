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

export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;

  for (const color of COLORS) {
    // 0 once per color
    cards.push({ id: id++, color, value: '0' });

    // 1-9 twice per color
    for (let run = 0; run < 2; run++) {
      for (let n = 1; n <= 9; n++) {
        cards.push({ id: id++, color, value: String(n) as Value });
      }
    }

    // skip, reverse, draw2 twice per color
    for (let run = 0; run < 2; run++) {
      cards.push({ id: id++, color, value: 'skip' });
      cards.push({ id: id++, color, value: 'reverse' });
      cards.push({ id: id++, color, value: 'draw2' });
    }
  }

  // 4 wild
  for (let i = 0; i < 4; i++) {
    cards.push({ id: id++, color: 'wild', value: 'wild' });
  }

  // 4 wild4
  for (let i = 0; i < 4; i++) {
    cards.push({ id: id++, color: 'wild', value: 'wild4' });
  }

  return cards;
}

export function shuffle<T>(array: T[], rng: () => number = Math.random): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export function isNumberCard(card: Card): boolean {
  return /^[0-9]$/.test(card.value);
}

export function isPlayable(
  card: Card,
  top: Card | null,
  currentColor: Color | null,
  pendingDraw: number = 0,
  pendingKind: 'draw2' | 'draw4' | null = null,
): boolean {
  if (!top) return false;

  if (pendingDraw > 0) {
    if (pendingKind === 'draw2') {
      return card.value === 'draw2';
    }
    if (pendingKind === 'draw4') {
      return card.value === 'wild4';
    }
    return false;
  }

  // pendingDraw === 0
  if (card.color === 'wild' || card.value === 'wild' || card.value === 'wild4') {
    return true;
  }

  if (currentColor && card.color === currentColor) {
    return true;
  }

  if (card.value === top.value) {
    return true;
  }

  return false;
}

export function getNextPlayerIndex(
  currentIndex: number,
  direction: 1 | -1,
  totalPlayers: number,
  steps: number = 1,
): number {
  if (totalPlayers <= 0) return 0;
  let next = (currentIndex + direction * steps) % totalPlayers;
  if (next < 0) next += totalPlayers;
  return next;
}
