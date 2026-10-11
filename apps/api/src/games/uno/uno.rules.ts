/**
 * Pure Uno game engine: cards, deck construction, move legality, scoring, and turn calculations.
 * Does not handle timers, websockets, or persistence.
 */

import type { GamePlayerRef } from '../game.types';
import { GameError } from '../game.types';

/** Cards dealt to each player at match start according to standard Uno rules (cards). */
export const INITIAL_HAND_SIZE = 7;
/** Minimum number of seated players required to start an Uno match (players). */
export const MIN_PLAYERS = 2;
/** Maximum player capacity supported at a single Uno table before joining as spectators (players). */
export const MAX_PLAYERS = 6;
/** Cards added to the pending penalty stack when a Draw Two card is played under Uno rules (cards). */
export const DRAW_TWO_CARDS_COUNT = 2;
/** Cards added to the pending penalty stack when a Wild Draw Four card is played under Uno rules (cards). */
export const WILD_FOUR_CARDS_COUNT = 4;
/** Penalty cards drawn by a player caught failing to call Uno before playing their penultimate card (cards). */
export const CATCH_PENALTY_CARDS_COUNT = 2;
/** Maximum hand size allowing a player to preemptively declare Uno prior to playing down to one card (cards). */
export const UNO_CALL_HAND_SIZE = 2;
/** Hand size leaving a player vulnerable to being caught if they did not declare Uno (cards). */
export const UNO_VULNERABLE_HAND_SIZE = 1;
/** Maximum recent match activity entries retained in the circular game event log (entries). */
export const MAX_LOG_ENTRIES = 8;
const WIN_SCORE = 500;
/** Points awarded to the winner for each action card remaining in opponents' hands under Uno scoring rules (points). */
export const SCORE_ACTION_CARD = 20;
/** Points awarded to the winner for each wild card remaining in opponents' hands under Uno scoring rules (points). */
export const SCORE_WILD_CARD = 50;
const TOTAL_DECK_SIZE = 108;
const NUM_WILD_CARDS = 4;
const NUM_WILD4_CARDS = 4;
const NUM_NON_ZERO_RUNS = 2;
const NUM_ACTION_RUNS = 2;
const MAX_NUMBER_CARD_VALUE = 9;

/** Four playable color suits defined by standard Uno rules. */
export type Color = 'red' | 'yellow' | 'green' | 'blue';

type Value =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

/** Single Uno playing card containing an identifier, assigned color suit, and face value. */
export interface Card {
  id: number;
  color: Color | 'wild';
  value: Value;
}

/** Server-side player representation tracking identity, secret hand cards, and Uno call status. */
export interface InternalUnoPlayer { ref: GamePlayerRef; hand: Card[]; saidUno: boolean; }
interface InternalUnoSpectator { ref: GamePlayerRef; }
interface UnoPlayer { id: string; name: string; character: string; cards: number; saidUno: boolean; }
interface UnoSpectator { id: string; name: string; }

/** Client-facing state projection sanitized for a specific player or spectator with hidden opponent hands. */
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

/** Authoritative server-side table state tracking draw piles, discard stack, turn order, and active penalties. */
export interface UnoGameState {
  phase: 'lobby' | 'playing' | 'ended';
  players: InternalUnoPlayer[];
  spectators: InternalUnoSpectator[];
  drawPile: Card[];
  discardPile: Card[];
  currentColor: Color | null;
  direction: 1 | -1;
  turnIndex: number;
  pendingDraw: number;
  pendingKind: 'draw2' | 'draw4' | null;
  drewCardId: number | null;
  vulnerableId: string | null;
  winnerId: string | null;
  log: string[];
}

const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];

/** Builds the standard 108-card Uno deck. */
export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;

  for (const color of COLORS) {
    cards.push({ id: id++, color, value: '0' });
    for (let run = 0; run < NUM_NON_ZERO_RUNS; run++) {
      for (let n = 1; n <= MAX_NUMBER_CARD_VALUE; n++) {
        cards.push({ id: id++, color, value: String(n) as Value });
      }
    }
    for (let run = 0; run < NUM_ACTION_RUNS; run++) {
      cards.push(
        { id: id++, color, value: 'skip' },
        { id: id++, color, value: 'reverse' },
        { id: id++, color, value: 'draw2' },
      );
    }
  }

  for (let i = 0; i < NUM_WILD_CARDS; i++) cards.push({ id: id++, color: 'wild', value: 'wild' });
  for (let i = 0; i < NUM_WILD4_CARDS; i++) cards.push({ id: id++, color: 'wild', value: 'wild4' });

  return cards;
}

/** Shuffles an array with a Fisher-Yates shuffle using injected rng. */
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

/** Returns true if the card is a standard 0-9 number card. */
export function isNumberCard(card: Card): boolean {
  return /^[0-9]$/.test(card.value);
}

/** Evaluates whether a card can be legally played on top of the discard pile. */
export function isPlayable(
  card: Card,
  top: Card | null,
  currentColor: Color | null,
  pendingDraw: number = 0,
  pendingKind: 'draw2' | 'draw4' | null = null,
): boolean {
  if (!top) return false;
  if (pendingDraw > 0) {
    if (pendingKind === 'draw2') return card.value === 'draw2';
    if (pendingKind === 'draw4') return card.value === 'wild4';
    return false;
  }
  if (card.color === 'wild' || card.value === 'wild' || card.value === 'wild4') return true;
  if (currentColor && card.color === currentColor) return true;
  return card.value === top.value;
}

/** Computes next player index considering wrap-around in current direction. */
export function getNextPlayerIndex(
  currentIndex: number,
  direction: 1 | -1,
  totalPlayers: number,
  steps: number = 1,
): number {
  if (totalPlayers <= 0) return 0;
  let next = (currentIndex + direction * steps) % totalPlayers;
  if (next < 0) next += totalPlayers;
  return next === 0 ? 0 : next;
}

/**
 * Computes next turn index and active direction after playing an action or standard card.
 * In a 2-player game, reverse acts as a skip (steps = 2) so the same player plays again.
 */
export function computeNextTurn(
  currentIndex: number,
  direction: 1 | -1,
  totalPlayers: number,
  value: string,
): { nextIndex: number; nextDirection: 1 | -1 } {
  if (value === 'skip') {
    return {
      nextIndex: getNextPlayerIndex(currentIndex, direction, totalPlayers, 2),
      nextDirection: direction,
    };
  }
  if (value === 'reverse') {
    const nextDirection = (direction === 1 ? -1 : 1) as 1 | -1;
    // WHY: In 2-player Uno, Reverse acts identically to Skip per official rules
    const steps = totalPlayers === 2 ? 2 : 1;
    return {
      nextIndex: getNextPlayerIndex(currentIndex, nextDirection, totalPlayers, steps),
      nextDirection,
    };
  }
  return {
    nextIndex: getNextPlayerIndex(currentIndex, direction, totalPlayers, 1),
    nextDirection: direction,
  };
}

/** Applies pending draw stacking for draw2 and wild4 cards. */
export function stackDrawPenalty(
  pendingDraw: number,
  value: string,
): { pendingDraw: number; pendingKind: 'draw2' | 'draw4' } {
  if (value === 'draw2') {
    return { pendingDraw: pendingDraw + DRAW_TWO_CARDS_COUNT, pendingKind: 'draw2' };
  }
  if (value === 'wild4') {
    return { pendingDraw: pendingDraw + WILD_FOUR_CARDS_COUNT, pendingKind: 'draw4' };
  }
  throw new GameError('illegal_play', `Cannot stack draw on non-draw card ${value}`);
}

/** Returns standard Uno score value for a single card. */
export function getCardScore(card: Card): number {
  if (isNumberCard(card)) return Number(card.value);
  if (card.value === 'wild' || card.value === 'wild4') return SCORE_WILD_CARD;
  return SCORE_ACTION_CARD;
}

/** Calculates total score value for a hand of cards. */
export function calculateHandScore(hand: Card[]): number {
  return hand.reduce((total, card) => total + getCardScore(card), 0);
}

/** Computes round winner points scored from all opponents' hands. */
export function calculateWinnerScore(opponentHands: Card[][]): number {
  return opponentHands.reduce((total, hand) => total + calculateHandScore(hand), 0);
}

/** Checks if a chosen color is one of the four valid Uno colors. */
export function isValidWildColor(color: unknown): color is Color {
  return typeof color === 'string' && (COLORS as readonly string[]).includes(color);
}

/** Resolves current color when playing a card, enforcing color selection for wild cards. */
export function resolveCardColor(card: Card, chosenColor?: Color): Color {
  if (card.color === 'wild') {
    if (!chosenColor || !isValidWildColor(chosenColor)) {
      throw new GameError('need_color', 'Must specify color for wild card');
    }
    return chosenColor;
  }
  return card.color as Color;
}

/** Validates whether a player may call Uno given their hand size and active turn status. */
export function canCallUno(handSize: number, isTurn: boolean): boolean {
  if (handSize === UNO_CALL_HAND_SIZE) return isTurn;
  if (handSize === UNO_VULNERABLE_HAND_SIZE) return true;
  return false;
}

/** Appends a message to the rolling game log, capping length at maxEntries. */
export function appendGameLog(
  log: string[],
  message: string,
  maxEntries: number = MAX_LOG_ENTRIES,
): void {
  log.push(message);
  if (log.length > maxEntries) {
    log.splice(0, log.length - maxEntries);
  }
}

/** Draws count cards from drawPile, recycling discardPile when drawPile is empty. */
export function drawCards(
  drawPile: Card[],
  discardPile: Card[],
  count: number,
  rng: () => number = Math.random,
): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (drawPile.length === 0 && discardPile.length > 1) {
      const top = discardPile.pop()!;
      drawPile.push(...shuffle(discardPile, rng));
      discardPile.length = 0;
      discardPile.push(top);
    }
    if (drawPile.length > 0) {
      drawn.push(drawPile.pop()!);
    } else {
      break;
    }
  }
  return drawn;
}

/** Deals starting hands to seated players and reveals the first number card on discard pile. */
export function dealStartingHands(
  players: InternalUnoPlayer[],
  drawPile: Card[],
  discardPile: Card[],
  rng: () => number = Math.random,
): Color {
  for (const player of players) {
    player.hand = drawCards(drawPile, discardPile, INITIAL_HAND_SIZE, rng);
    player.saidUno = false;
  }
  let firstTop = drawCards(drawPile, discardPile, 1, rng)[0];
  while (!isNumberCard(firstTop)) {
    drawPile.unshift(firstTop);
    const recycled = shuffle(drawPile, rng);
    drawPile.length = 0;
    drawPile.push(...recycled);
    firstTop = drawCards(drawPile, discardPile, 1, rng)[0];
  }
  discardPile.push(firstTop);
  return firstTop.color as Color;
}

/** Computes next active turn index when a player leaves the table mid-game. */
export function computeTurnOnPlayerLeave(
  leavingIndex: number,
  currentTurnIndex: number,
  direction: 1 | -1,
  remainingPlayersCount: number,
): number {
  if (remainingPlayersCount <= 0) return 0;
  if (leavingIndex === currentTurnIndex) {
    return direction === 1
      ? leavingIndex % remainingPlayersCount
      : (leavingIndex - 1 + remainingPlayersCount) % remainingPlayersCount;
  }
  return leavingIndex < currentTurnIndex ? currentTurnIndex - 1 : currentTurnIndex;
}

/** Returns list of playable card IDs for the given player hand. */
export function getPlayableCardIds(
  hand: Card[],
  top: Card | null,
  currentColor: Color | null,
  pendingDraw: number,
  pendingKind: 'draw2' | 'draw4' | null,
  drewCardId: number | null,
): number[] {
  if (drewCardId !== null) {
    const drawnCard = hand.find((c) => c.id === drewCardId);
    return drawnCard && isPlayable(drawnCard, top, currentColor, pendingDraw, pendingKind)
      ? [drawnCard.id]
      : [];
  }
  return hand
    .filter((c) => isPlayable(c, top, currentColor, pendingDraw, pendingKind))
    .map((c) => c.id);
}

/** Creates an empty initial Uno game state in lobby phase. */
export function createInitialUnoState(): UnoGameState {
  return {
    phase: 'lobby', players: [], spectators: [], drawPile: [], discardPile: [],
    currentColor: null, direction: 1, turnIndex: 0, pendingDraw: 0, pendingKind: null,
    drewCardId: null, vulnerableId: null, winnerId: null, log: [],
  };
}

/** Builds client view of current Uno game state for specified user. */
export function buildUnoView(state: UnoGameState, userId: string): UnoView {
  const isPlayer = state.players.some((p) => p.ref.userId === userId);
  const myPlayer = state.players.find((p) => p.ref.userId === userId);
  const isMyTurn = state.phase === 'playing' && state.players[state.turnIndex]?.ref.userId === userId;
  const topCard = state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1] : null;

  let hand: Card[] = [];
  let drewCardIdForView: number | null = null;
  let playable: number[] = [];

  if (isPlayer && myPlayer) {
    hand = myPlayer.hand;
    if (isMyTurn) {
      drewCardIdForView = state.drewCardId;
      playable = getPlayableCardIds(
        myPlayer.hand,
        topCard,
        state.currentColor,
        state.pendingDraw,
        state.pendingKind,
        state.drewCardId,
      );
    }
  }

  return {
    phase: state.phase,
    hostId: state.players[0]?.ref.userId ?? null,
    role: isPlayer ? 'player' : 'spectator',
    hand,
    players: state.players.map((p) => ({
      id: p.ref.userId, name: p.ref.name, character: p.ref.character, cards: p.hand.length, saidUno: p.saidUno,
    })),
    spectators: state.spectators.map((s) => ({ id: s.ref.userId, name: s.ref.name })),
    turnId: state.phase === 'playing' ? (state.players[state.turnIndex]?.ref.userId ?? null) : null,
    direction: state.direction,
    top: topCard,
    currentColor: state.currentColor,
    drawPile: state.drawPile.length,
    pendingDraw: state.pendingDraw,
    pendingKind: state.pendingKind,
    drewCardId: drewCardIdForView,
    playable,
    vulnerableId: state.vulnerableId,
    winnerId: state.winnerId,
    log: [...state.log],
  };
}
