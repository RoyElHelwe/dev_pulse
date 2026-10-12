/**
 * Unit tests for pure Uno engine rules: deck generation, move legality, draw stacking,
 * turn progression with 2 or more players, wild color resolution, and scoring.
 */

import { describe, expect, it } from 'vitest';
import type { Card, Color, InternalUnoPlayer } from './uno.rules';
import {
  CATCH_PENALTY_CARDS_COUNT,
  DRAW_TWO_CARDS_COUNT,
  INITIAL_HAND_SIZE,
  MAX_LOG_ENTRIES,
  SCORE_ACTION_CARD,
  SCORE_WILD_CARD,
  WILD_FOUR_CARDS_COUNT,
  appendGameLog,
  canCallUno,
  calculateHandScore,
  calculateWinnerScore,
  computeNextTurn,
  computeTurnOnPlayerLeave,
  dealStartingHands,
  drawCards,
  getCardScore,
  getPlayableCardIds,
  isPlayable,
  isValidWildColor,
  resolveCardColor,
  stackDrawPenalty,
} from './uno.rules';

describe('Uno Pure Engine Rules', () => {
  describe('Legal-move check (isPlayable & getPlayableCardIds)', () => {
    const red5: Card = { id: 1, color: 'red', value: '5' };

    it('allows playing matching color or matching value', () => {
      expect(isPlayable({ id: 2, color: 'red', value: '9' }, red5, 'red')).toBe(true);
      expect(isPlayable({ id: 3, color: 'blue', value: '5' }, red5, 'red')).toBe(true);
      expect(isPlayable({ id: 4, color: 'green', value: '2' }, red5, 'red')).toBe(false);
    });

    it('allows playing wild cards when no draw penalty is pending', () => {
      expect(isPlayable({ id: 5, color: 'wild', value: 'wild' }, red5, 'red')).toBe(true);
      expect(isPlayable({ id: 6, color: 'wild', value: 'wild4' }, red5, 'red')).toBe(true);
    });

    it('returns false when discard top card is null', () => {
      expect(isPlayable(red5, null, 'red')).toBe(false);
    });

    it('enforces stacking constraints when draw2 penalty is pending', () => {
      const draw2Card: Card = { id: 7, color: 'blue', value: 'draw2' };
      const nonDrawCard: Card = { id: 8, color: 'red', value: '2' };
      const wild4Card: Card = { id: 9, color: 'wild', value: 'wild4' };

      expect(isPlayable(draw2Card, red5, 'red', 2, 'draw2')).toBe(true);
      expect(isPlayable(nonDrawCard, red5, 'red', 2, 'draw2')).toBe(false);
      expect(isPlayable(wild4Card, red5, 'red', 2, 'draw2')).toBe(false);
    });

    it('enforces stacking constraints when wild4 penalty is pending', () => {
      const draw2Card: Card = { id: 10, color: 'blue', value: 'draw2' };
      const wild4Card: Card = { id: 11, color: 'wild', value: 'wild4' };

      expect(isPlayable(wild4Card, red5, 'red', 4, 'draw4')).toBe(true);
      expect(isPlayable(draw2Card, red5, 'red', 4, 'draw4')).toBe(false);
    });

    it('getPlayableCardIds filters hand or restricts to drawn card', () => {
      const hand: Card[] = [
        { id: 20, color: 'red', value: '1' },
        { id: 21, color: 'blue', value: '5' },
        { id: 22, color: 'yellow', value: '9' },
      ];

      // Normal turn: Red 1 and Blue 5 are playable on Red 5
      expect(getPlayableCardIds(hand, red5, 'red', 0, null, null)).toEqual([20, 21]);

      // If card was drawn, only that specific card can be played if valid
      expect(getPlayableCardIds(hand, red5, 'red', 0, null, 20)).toEqual([20]);
      // If drawn card is unplayable, returns empty array
      expect(getPlayableCardIds(hand, red5, 'red', 0, null, 22)).toEqual([]);
    });
  });

  describe('Stacking draws (stackDrawPenalty)', () => {
    it('stacks draw2 penalty by DRAW_TWO_CARDS_COUNT', () => {
      const step1 = stackDrawPenalty(0, 'draw2');
      expect(step1).toEqual({ pendingDraw: DRAW_TWO_CARDS_COUNT, pendingKind: 'draw2' });

      const step2 = stackDrawPenalty(step1.pendingDraw, 'draw2');
      expect(step2).toEqual({ pendingDraw: 4, pendingKind: 'draw2' });
    });

    it('stacks wild4 penalty by WILD_FOUR_CARDS_COUNT', () => {
      const step1 = stackDrawPenalty(0, 'wild4');
      expect(step1).toEqual({ pendingDraw: WILD_FOUR_CARDS_COUNT, pendingKind: 'draw4' });

      const step2 = stackDrawPenalty(step1.pendingDraw, 'wild4');
      expect(step2).toEqual({ pendingDraw: 8, pendingKind: 'draw4' });
    });

    it('rejects stacking on non-draw card values', () => {
      expect(() => stackDrawPenalty(2, 'skip')).toThrowError(
        expect.objectContaining({ code: 'illegal_play' }),
      );
    });
  });

  describe('Reverse and Skip with 2 players vs multi-players', () => {
    it('in 2-player game, reverse acts as a skip so the same player goes again', () => {
      const result = computeNextTurn(0, 1, 2, 'reverse');
      expect(result.nextDirection).toBe(-1);
      expect(result.nextIndex).toBe(0); // Player 0 gets next turn again
    });

    it('in 2-player game, skip keeps direction and lets the same player go again', () => {
      const result = computeNextTurn(1, 1, 2, 'skip');
      expect(result.nextDirection).toBe(1);
      expect(result.nextIndex).toBe(1); // Player 1 gets next turn again
    });

    it('in 3-player game, reverse flips direction and moves by 1 step', () => {
      // 0 with direction 1 flips to -1, stepping back to player 2
      const result = computeNextTurn(0, 1, 3, 'reverse');
      expect(result.nextDirection).toBe(-1);
      expect(result.nextIndex).toBe(2);

      // Reversing again from 2 in -1 direction flips to 1, stepping forward to player 0
      const reverseBack = computeNextTurn(2, -1, 3, 'reverse');
      expect(reverseBack.nextDirection).toBe(1);
      expect(reverseBack.nextIndex).toBe(0);
    });

    it('in 3-player game, skip jumps over the next player', () => {
      const result = computeNextTurn(0, 1, 3, 'skip');
      expect(result.nextDirection).toBe(1);
      expect(result.nextIndex).toBe(2);
    });

    it('standard number card steps forward by 1 in current direction', () => {
      const fwd = computeNextTurn(1, 1, 4, '7');
      expect(fwd).toEqual({ nextIndex: 2, nextDirection: 1 });

      const back = computeNextTurn(1, -1, 4, '7');
      expect(back).toEqual({ nextIndex: 0, nextDirection: -1 });
    });
  });

  describe('Wild color resolution (isValidWildColor & resolveCardColor)', () => {
    it('validates official Uno colors', () => {
      expect(isValidWildColor('red')).toBe(true);
      expect(isValidWildColor('yellow')).toBe(true);
      expect(isValidWildColor('green')).toBe(true);
      expect(isValidWildColor('blue')).toBe(true);
      expect(isValidWildColor('wild')).toBe(false);
      expect(isValidWildColor('purple')).toBe(false);
      expect(isValidWildColor(null)).toBe(false);
    });

    it('requires chosen color for wild cards', () => {
      const wildCard: Card = { id: 30, color: 'wild', value: 'wild' };
      expect(resolveCardColor(wildCard, 'blue')).toBe('blue');

      expect(() => resolveCardColor(wildCard, undefined)).toThrowError(
        expect.objectContaining({ code: 'need_color' }),
      );
      expect(() => resolveCardColor(wildCard, 'black' as Color)).toThrowError(
        expect.objectContaining({ code: 'need_color' }),
      );
    });

    it('returns card color for regular colored cards', () => {
      const regularCard: Card = { id: 31, color: 'green', value: '4' };
      expect(resolveCardColor(regularCard, 'red')).toBe('green');
    });
  });

  describe('Scoring (getCardScore, calculateHandScore, calculateWinnerScore)', () => {
    it('scores number cards with their face value', () => {
      expect(getCardScore({ id: 1, color: 'red', value: '0' })).toBe(0);
      expect(getCardScore({ id: 2, color: 'yellow', value: '7' })).toBe(7);
      expect(getCardScore({ id: 3, color: 'blue', value: '9' })).toBe(9);
    });

    it('scores action cards at SCORE_ACTION_CARD (20 points)', () => {
      expect(getCardScore({ id: 4, color: 'green', value: 'skip' })).toBe(SCORE_ACTION_CARD);
      expect(getCardScore({ id: 5, color: 'red', value: 'reverse' })).toBe(SCORE_ACTION_CARD);
      expect(getCardScore({ id: 6, color: 'blue', value: 'draw2' })).toBe(SCORE_ACTION_CARD);
    });

    it('scores wild cards at SCORE_WILD_CARD (50 points)', () => {
      expect(getCardScore({ id: 7, color: 'wild', value: 'wild' })).toBe(SCORE_WILD_CARD);
      expect(getCardScore({ id: 8, color: 'wild', value: 'wild4' })).toBe(SCORE_WILD_CARD);
    });

    it('computes total hand score accurately', () => {
      const hand: Card[] = [
        { id: 1, color: 'red', value: '0' },
        { id: 2, color: 'green', value: '5' },
        { id: 3, color: 'blue', value: 'skip' }, // 20
        { id: 4, color: 'wild', value: 'wild4' }, // 50
      ];
      expect(calculateHandScore(hand)).toBe(0 + 5 + 20 + 50);
    });

    it('computes winner score from multiple opponents hands', () => {
      const opponent1: Card[] = [{ id: 1, color: 'red', value: '3' }]; // 3
      const opponent2: Card[] = [{ id: 2, color: 'wild', value: 'wild' }]; // 50
      expect(calculateWinnerScore([opponent1, opponent2])).toBe(53);
    });
  });

  describe('Piles, deals, turn calculation and log helpers', () => {
    it('canCallUno checks correct hand size conditions', () => {
      expect(canCallUno(2, true)).toBe(true);
      expect(canCallUno(2, false)).toBe(false);
      expect(canCallUno(1, false)).toBe(true);
      expect(canCallUno(3, true)).toBe(false);
    });

    it('drawCards recycles discard pile when draw pile is exhausted', () => {
      const drawPile: Card[] = [];
      const discardPile: Card[] = [
        { id: 1, color: 'red', value: '1' },
        { id: 2, color: 'blue', value: '2' },
        { id: 3, color: 'green', value: '3' },
      ];

      const drawn = drawCards(drawPile, discardPile, 2, () => 0.5);
      expect(drawn).toHaveLength(2);
      // Top card (id 3) remains on discard pile
      expect(discardPile).toEqual([{ id: 3, color: 'green', value: '3' }]);
    });

    it('dealStartingHands deals INITIAL_HAND_SIZE and reveals number card', () => {
      const players: InternalUnoPlayer[] = [
        { ref: { userId: 'u1', name: 'Alice', character: 'maya' }, hand: [], saidUno: false },
        { ref: { userId: 'u2', name: 'Bob', character: 'sam' }, hand: [], saidUno: false },
      ];
      // Deck with top card (index 0) as Red 5, and 14 cards (indices 1..14) for players to draw
      const drawPile: Card[] = [
        { id: 2, color: 'red', value: '5' },
        ...Array.from({ length: 14 }, (_, i) => ({ id: 10 + i, color: 'blue' as Color, value: '1' as const })),
      ];
      const discardPile: Card[] = [];

      const color = dealStartingHands(players, drawPile, discardPile);
      expect(players[0].hand).toHaveLength(INITIAL_HAND_SIZE);
      expect(players[1].hand).toHaveLength(INITIAL_HAND_SIZE);
      expect(discardPile).toHaveLength(1);
      expect(discardPile[0].value).toBe('5');
      expect(color).toBe('red');
    });

    it('computeTurnOnPlayerLeave adjusts turn index based on direction and position', () => {
      // Current turn was player 1 in direction 1 with 2 players left: moves to player 1 % 2 = 1
      expect(computeTurnOnPlayerLeave(1, 1, 1, 2)).toBe(1);
      // Current turn was player 1 in direction -1 with 2 players left: moves to (1 - 1 + 2) % 2 = 0
      expect(computeTurnOnPlayerLeave(1, 1, -1, 2)).toBe(0);
      // Player before current turn leaves: index shifts down by 1
      expect(computeTurnOnPlayerLeave(0, 2, 1, 2)).toBe(1);
      // Player after current turn leaves: index unchanged
      expect(computeTurnOnPlayerLeave(3, 1, 1, 3)).toBe(1);
    });

    it('appendGameLog limits log size to MAX_LOG_ENTRIES', () => {
      const log: string[] = [];
      for (let i = 1; i <= 10; i++) {
        appendGameLog(log, `msg ${i}`, MAX_LOG_ENTRIES);
      }
      expect(log).toHaveLength(MAX_LOG_ENTRIES);
      expect(log[0]).toBe('msg 3');
      expect(log[MAX_LOG_ENTRIES - 1]).toBe('msg 10');
    });
  });
});
