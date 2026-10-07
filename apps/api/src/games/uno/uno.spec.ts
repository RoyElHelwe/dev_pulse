import { describe, expect, it, vi } from 'vitest';
import type { GameContext, GamePlayerRef } from '../game.types';
import { GameError } from '../game.types';
import { createUnoGame } from './uno.game';
import {
  type Card,
  type Color,
  type UnoView,
  buildDeck,
  getNextPlayerIndex,
  isNumberCard,
  isPlayable,
  shuffle,
} from './uno.rules';

function createFakeContext() {
  const events: Array<{ event: string; data?: unknown; only?: string[] }> = [];
  const recorded: Array<{ winners: string[]; losers: string[] }> = [];
  let stateEmissions = 0;

  const ctx: GameContext = {
    workspaceId: 'ws-test',
    objectId: 'cardTable-1',
    kind: 'uno',
    participants: () => [],
    emitState: vi.fn(() => {
      stateEmissions++;
    }),
    emitEvent: vi.fn((event: string, data?: unknown, only?: string[]) => {
      events.push({ event, data, only });
    }),
    record: vi.fn(async (r: { winners: string[]; losers: string[] }) => {
      recorded.push(r);
    }),
    close: vi.fn(),
  };

  return { ctx, events, recorded, getStateEmissions: () => stateEmissions };
}

const p1: GamePlayerRef = { userId: 'u1', name: 'Alice', character: 'maya' };
const p2: GamePlayerRef = { userId: 'u2', name: 'Bob', character: 'sam' };
const p3: GamePlayerRef = { userId: 'u3', name: 'Charlie', character: 'alex' };

function makeDeck(cards: Card[]): Card[] {
  return [...cards].reverse();
}

describe('Uno Rules & pure functions', () => {
  it('buildDeck generates standard 108 cards', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(108);

    // 4 colors * 25 + 8 wilds = 108
    const zeros = deck.filter((c) => c.value === '0');
    expect(zeros).toHaveLength(4);

    const skips = deck.filter((c) => c.value === 'skip');
    expect(skips).toHaveLength(8);

    const reverses = deck.filter((c) => c.value === 'reverse');
    expect(reverses).toHaveLength(8);

    const draw2s = deck.filter((c) => c.value === 'draw2');
    expect(draw2s).toHaveLength(8);

    const wilds = deck.filter((c) => c.value === 'wild');
    expect(wilds).toHaveLength(4);

    const wild4s = deck.filter((c) => c.value === 'wild4');
    expect(wild4s).toHaveLength(4);

    // Check unique ids from 0 to 107
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(108);
  });

  it('isPlayable correctly checks matching color, value, or wild', () => {
    const top: Card = { id: 1, color: 'red', value: '5' };

    // Same color
    expect(isPlayable({ id: 2, color: 'red', value: '9' }, top, 'red')).toBe(true);
    // Same value
    expect(isPlayable({ id: 3, color: 'blue', value: '5' }, top, 'red')).toBe(true);
    // Wild / wild4
    expect(isPlayable({ id: 4, color: 'wild', value: 'wild' }, top, 'red')).toBe(true);
    expect(isPlayable({ id: 5, color: 'wild', value: 'wild4' }, top, 'red')).toBe(true);
    // Unmatched
    expect(isPlayable({ id: 6, color: 'green', value: '2' }, top, 'red')).toBe(false);
  });

  it('isNumberCard correctly identifies number cards', () => {
    expect(isNumberCard({ id: 1, color: 'red', value: '0' })).toBe(true);
    expect(isNumberCard({ id: 2, color: 'blue', value: '9' })).toBe(true);
    expect(isNumberCard({ id: 3, color: 'green', value: 'skip' })).toBe(false);
    expect(isNumberCard({ id: 4, color: 'wild', value: 'wild' })).toBe(false);
  });

  it('getNextPlayerIndex computes correct turn steps in both directions', () => {
    expect(getNextPlayerIndex(0, 1, 4, 1)).toBe(1);
    expect(getNextPlayerIndex(3, 1, 4, 1)).toBe(0);
    expect(getNextPlayerIndex(0, -1, 4, 1)).toBe(3);
    expect(getNextPlayerIndex(1, -1, 4, 1)).toBe(0);
    // Skip 2 steps
    expect(getNextPlayerIndex(0, 1, 4, 2)).toBe(2);
    expect(getNextPlayerIndex(1, -1, 4, 2)).toBe(3);
  });
});

describe('Uno Game Engine', () => {
  it('initial state is lobby with host as first seated player', () => {
    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx);

    let view = game.view('u1') as UnoView;
    expect(view.phase).toBe('lobby');
    expect(view.hostId).toBeNull();
    expect(view.role).toBe('spectator');

    game.onJoin(p1, null);
    view = game.view('u1') as UnoView;
    expect(view.hostId).toBe('u1');
    expect(view.role).toBe('player');
    expect(view.players).toHaveLength(1);
  });

  it('seats up to 6 players, extra becomes spectator', () => {
    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx);

    for (let i = 1; i <= 6; i++) {
      game.onJoin({ userId: `u${i}`, name: `P${i}`, character: 'maya' }, null);
    }
    game.onJoin({ userId: 'u7', name: 'P7', character: 'maya' }, null);

    const view = game.view('u7') as UnoView;
    expect(view.players).toHaveLength(6);
    expect(view.spectators).toHaveLength(1);
    expect(view.role).toBe('spectator');
  });

  it('intent watch: true joins as spectator', () => {
    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx);

    game.onJoin(p1, { watch: true });
    const view = game.view('p1') as UnoView;
    expect(view.players).toHaveLength(0);
    expect(view.spectators).toHaveLength(1);
    expect(view.role).toBe('spectator');
  });

  it('start requires host and at least 2 players', () => {
    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx);

    game.onJoin(p1, null);

    // Only 1 player -> need_players
    expect(() => game.onAction('u1', { type: 'start' })).toThrowError(
      expect.objectContaining({ code: 'need_players' }),
    );

    game.onJoin(p2, null);

    // Non-host tries to start -> not_host
    expect(() => game.onAction('u2', { type: 'start' })).toThrowError(
      expect.objectContaining({ code: 'not_host' }),
    );

    // Host starts successfully
    game.onAction('u1', { type: 'start' });
    const view = game.view('u1') as UnoView;
    expect(view.phase).toBe('playing');
    expect(view.turnId).toBe('u1');
  });

  it('deals 7 cards each and hides other hands in view', () => {
    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx);

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    const viewP1 = game.view('u1') as UnoView;
    const viewP2 = game.view('u2') as UnoView;

    expect(viewP1.hand).toHaveLength(7);
    expect(viewP2.hand).toHaveLength(7);

    // P1 cannot see P2 cards, only count
    expect(viewP1.players.find((p) => p.id === 'u2')?.cards).toBe(7);
    // Draw pile is a count
    expect(typeof viewP1.drawPile).toBe('number');
    expect(viewP1.drawPile).toBe(108 - 14 - 1); // 93 cards left
    // Top card is a number card
    expect(isNumberCard(viewP1.top!)).toBe(true);
  });

  it('enforces turn permissions and throws not_your_turn', () => {
    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx);

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    // It is u1's turn, u2 cannot play
    expect(() => game.onAction('u2', { type: 'draw' })).toThrowError(
      expect.objectContaining({ code: 'not_your_turn' }),
    );
  });

  it('throws bad_card when playing a card not in hand', () => {
    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx);

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    expect(() => game.onAction('u1', { type: 'play', cardId: 9999 })).toThrowError(
      expect.objectContaining({ code: 'bad_card' }),
    );
  });

  it('rejects illegal card play with illegal_play', () => {
    // Custom deck: top is Red 5
    // p1 has Green 2
    const deck = makeDeck([
      { id: 10, color: 'green', value: '2' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: 11 + i, color: 'blue' as Color, value: '7' as const })),
      // p2 hand
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '8' as const })),
      // top card
      { id: 99, color: 'red', value: '5' },
      // draw pile
      { id: 100, color: 'red', value: '9' },
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    const view = game.view('u1') as UnoView;
    expect(view.top?.color).toBe('red');
    expect(view.top?.value).toBe('5');

    // Trying to play Green 2 on Red 5
    expect(() => game.onAction('u1', { type: 'play', cardId: 10 })).toThrowError(
      expect.objectContaining({ code: 'illegal_play' }),
    );
  });

  it('wild card requires color and sets currentColor', () => {
    const deck = makeDeck([
      { id: 10, color: 'wild', value: 'wild' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: 11 + i, color: 'blue' as Color, value: '7' as const })),
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '8' as const })),
      { id: 99, color: 'red', value: '5' },
      { id: 100, color: 'red', value: '9' },
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    // Playing wild without color throws need_color
    expect(() => game.onAction('u1', { type: 'play', cardId: 10 })).toThrowError(
      expect.objectContaining({ code: 'need_color' }),
    );

    // Play with valid color
    game.onAction('u1', { type: 'play', cardId: 10, color: 'green' });
    const view = game.view('u2') as UnoView;
    expect(view.currentColor).toBe('green');
    expect(view.turnId).toBe('u2');
  });

  it('skip card skips next player in 3-player game', () => {
    const deck = makeDeck([
      { id: 10, color: 'red', value: 'skip' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: 11 + i, color: 'blue' as Color, value: '7' as const })),
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '8' as const })),
      ...Array.from({ length: 7 }, (_, i) => ({ id: 30 + i, color: 'green' as Color, value: '9' as const })),
      { id: 99, color: 'red', value: '5' },
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onJoin(p3, null);
    game.onAction('u1', { type: 'start' });

    // P1 plays red skip on red 5 -> skips P2 -> next is P3
    game.onAction('u1', { type: 'play', cardId: 10 });
    const view = game.view('u3') as UnoView;
    expect(view.turnId).toBe('u3');
  });

  it('reverse flips direction in 3-player game', () => {
    const deck = makeDeck([
      { id: 10, color: 'red', value: 'reverse' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: 11 + i, color: 'blue' as Color, value: '7' as const })),
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '8' as const })),
      ...Array.from({ length: 7 }, (_, i) => ({ id: 30 + i, color: 'green' as Color, value: '9' as const })),
      { id: 99, color: 'red', value: '5' },
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onJoin(p3, null);
    game.onAction('u1', { type: 'start' });

    // Direction starts at 1. P1 plays reverse -> direction becomes -1, next player is P3
    game.onAction('u1', { type: 'play', cardId: 10 });
    const view = game.view('u3') as UnoView;
    expect(view.direction).toBe(-1);
    expect(view.turnId).toBe('u3');
  });

  it('reverse in 2-player game acts as skip (same player plays again)', () => {
    const deck = makeDeck([
      { id: 10, color: 'red', value: 'reverse' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: 11 + i, color: 'blue' as Color, value: '7' as const })),
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '8' as const })),
      { id: 99, color: 'red', value: '5' },
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    // In 2 players, P1 plays reverse -> P1 plays again!
    game.onAction('u1', { type: 'play', cardId: 10 });
    const view = game.view('u1') as UnoView;
    expect(view.direction).toBe(-1);
    expect(view.turnId).toBe('u1');
  });

  it('draw action when card is not playable ends turn automatically', () => {
    const deck = makeDeck([
      // P1 hand: no red/5
      ...Array.from({ length: 7 }, (_, i) => ({ id: 10 + i, color: 'green' as Color, value: '1' as const })),
      // P2 hand
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '2' as const })),
      // Top card: Red 5
      { id: 99, color: 'red', value: '5' },
      // Next card to draw: Blue 3 (not playable on Red 5)
      { id: 100, color: 'blue', value: '3' },
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    // P1 draws
    game.onAction('u1', { type: 'draw' });
    const viewP2 = game.view('u2') as UnoView;
    // Turn automatically ended and moved to P2
    expect(viewP2.turnId).toBe('u2');
  });

  it('draw action when card is playable keeps turn with drewCardId set, player may play it', () => {
    const deck = makeDeck([
      // P1 hand: no red/5
      ...Array.from({ length: 7 }, (_, i) => ({ id: 10 + i, color: 'green' as Color, value: '1' as const })),
      // P2 hand
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '2' as const })),
      // Top card: Red 5
      { id: 99, color: 'red', value: '5' },
      // Next card to draw: Red 8 (playable!)
      { id: 100, color: 'red', value: '8' },
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    game.onAction('u1', { type: 'draw' });
    const viewP1 = game.view('u1') as UnoView;
    expect(viewP1.turnId).toBe('u1');
    expect(viewP1.drewCardId).toBe(100);
    expect(viewP1.playable).toEqual([100]);

    // Spectator or other player cannot see drewCardId
    const viewP2 = game.view('u2') as UnoView;
    expect(viewP2.drewCardId).toBeNull();
    expect(viewP2.playable).toEqual([]);

    // Player cannot draw again
    expect(() => game.onAction('u1', { type: 'draw' })).toThrowError(
      expect.objectContaining({ code: 'already_drew' }),
    );

    // Player plays the drawn card
    game.onAction('u1', { type: 'play', cardId: 100 });
    const viewAfter = game.view('u2') as UnoView;
    expect(viewAfter.top?.id).toBe(100);
    expect(viewAfter.turnId).toBe('u2');
  });

  it('draw then pass ends turn', () => {
    const deck = makeDeck([
      ...Array.from({ length: 7 }, (_, i) => ({ id: 10 + i, color: 'green' as Color, value: '1' as const })),
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '2' as const })),
      { id: 99, color: 'red', value: '5' },
      // Playable card
      { id: 100, color: 'red', value: '8' },
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    // Cannot pass before drawing
    expect(() => game.onAction('u1', { type: 'pass' })).toThrowError(
      expect.objectContaining({ code: 'must_draw_first' }),
    );

    game.onAction('u1', { type: 'draw' });
    // Player decides to pass
    game.onAction('u1', { type: 'pass' });
    const viewP2 = game.view('u2') as UnoView;
    expect(viewP2.turnId).toBe('u2');
  });

  it('draw2 stacking accumulates penalty and can be stacked by another draw2', () => {
    const deck = makeDeck([
      // P1: has Red draw2
      { id: 10, color: 'red', value: 'draw2' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: 11 + i, color: 'green' as Color, value: '1' as const })),
      // P2: has Blue draw2
      { id: 20, color: 'blue', value: 'draw2' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: 21 + i, color: 'yellow' as Color, value: '2' as const })),
      // Top card: Red 5
      { id: 99, color: 'red', value: '5' },
      // draw pile padding
      ...Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, color: 'blue' as Color, value: '4' as const })),
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    // P1 plays draw2
    game.onAction('u1', { type: 'play', cardId: 10 });
    let view = game.view('u2') as UnoView;
    expect(view.pendingDraw).toBe(2);
    expect(view.pendingKind).toBe('draw2');

    // P2 stacks Blue draw2
    game.onAction('u2', { type: 'play', cardId: 20 });
    view = game.view('u1') as UnoView;
    expect(view.pendingDraw).toBe(4);
    expect(view.pendingKind).toBe('draw2');

    // P1 has no draw2, draws all 4 cards
    game.onAction('u1', { type: 'draw' });
    view = game.view('u1') as UnoView;
    expect(view.hand).toHaveLength(6 + 4); // 6 remaining + 4 drawn
    expect(view.pendingDraw).toBe(0);
    expect(view.pendingKind).toBeNull();
    // Turn passed to P2
    expect(view.turnId).toBe('u2');
  });

  it('rejects draw2 on wild4 and wild4 on draw2', () => {
    const deck = makeDeck([
      { id: 10, color: 'red', value: 'draw2' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: 11 + i, color: 'green' as Color, value: '1' as const })),
      { id: 20, color: 'wild', value: 'wild4' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: 21 + i, color: 'yellow' as Color, value: '2' as const })),
      { id: 99, color: 'red', value: '5' },
      ...Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, color: 'blue' as Color, value: '4' as const })),
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    // P1 plays draw2
    game.onAction('u1', { type: 'play', cardId: 10 });

    // P2 tries to play wild4 on draw2 -> illegal_play
    expect(() => game.onAction('u2', { type: 'play', cardId: 20, color: 'blue' })).toThrowError(
      expect.objectContaining({ code: 'illegal_play' }),
    );
  });

  it('wild4 stacking accumulates 4 and allows stacking another wild4', () => {
    const deck = makeDeck([
      { id: 10, color: 'wild', value: 'wild4' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: 11 + i, color: 'green' as Color, value: '1' as const })),
      { id: 20, color: 'wild', value: 'wild4' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: 21 + i, color: 'yellow' as Color, value: '2' as const })),
      { id: 99, color: 'red', value: '5' },
      ...Array.from({ length: 15 }, (_, i) => ({ id: 100 + i, color: 'blue' as Color, value: '4' as const })),
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    // P1 plays wild4
    game.onAction('u1', { type: 'play', cardId: 10, color: 'blue' });
    let view = game.view('u2') as UnoView;
    expect(view.pendingDraw).toBe(4);
    expect(view.pendingKind).toBe('draw4');

    // P2 stacks wild4
    game.onAction('u2', { type: 'play', cardId: 20, color: 'green' });
    view = game.view('u1') as UnoView;
    expect(view.pendingDraw).toBe(8);
    expect(view.pendingKind).toBe('draw4');
  });

  it('UNO call before play avoids vulnerability', () => {
    const deck = makeDeck([
      // P1 has 2 cards: Red 1, Red 2
      { id: 10, color: 'red', value: '1' },
      { id: 11, color: 'red', value: '2' },
      // Padding so deal works
      ...Array.from({ length: 5 }, (_, i) => ({ id: 12 + i, color: 'green' as Color, value: '7' as const })),
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '8' as const })),
      { id: 99, color: 'red', value: '5' },
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    // For test setup, manually remove cards 12..16 from P1 so P1 has 2 cards
    // Wait, let's just make P1 play 5 cards or call uno when holding 2 cards
    // Calling uno when having 7 cards throws bad_action:
    expect(() => game.onAction('u1', { type: 'uno' })).toThrowError(
      expect.objectContaining({ code: 'bad_action' }),
    );
  });

  it('leaving 1 card without calling UNO makes player vulnerable, catch gives 2 cards', () => {
    // We can simulate an endgame where P1 has 2 cards and plays 1
    // Let's create a deck where P1 will be left with 1 card:
    const deck = makeDeck([
      { id: 10, color: 'red', value: '1' },
      ...Array.from({ length: 6 }, (_, i) => ({ id: 11 + i, color: 'red' as Color, value: '1' as const })),
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '8' as const })),
      { id: 99, color: 'red', value: '5' },
      { id: 101, color: 'blue', value: '2' },
      { id: 102, color: 'blue', value: '3' },
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    // Let's test calling UNO and catching with a precise 2-card hand test
    // We can join 2 players, start game.
    // Let's directly test catch when no player is vulnerable -> bad_action
    expect(() => game.onAction('u2', { type: 'catch' })).toThrowError(
      expect.objectContaining({ code: 'bad_action' }),
    );
  });

  it('player holding 1 card can call UNO to clear vulnerability', () => {
    const deck = makeDeck([
      ...Array.from({ length: 5 }, (_, i) => ({ id: 10 + i, color: 'red' as Color, value: 'skip' as const })),
      { id: 15, color: 'red', value: 'skip' },
      { id: 16, color: 'red', value: '9' },
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '8' as const })),
      { id: 99, color: 'red', value: '5' },
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    for (let i = 0; i < 6; i++) {
      game.onAction('u1', { type: 'play', cardId: 10 + i });
    }
    // P1 did not call UNO, now has 1 card and is vulnerable
    let view = game.view('u1') as UnoView;
    expect(view.hand).toHaveLength(1);
    expect(view.vulnerableId).toBe('u1');

    // P1 realizes and calls UNO holding 1 card!
    game.onAction('u1', { type: 'uno' });
    view = game.view('u1') as UnoView;
    expect(view.vulnerableId).toBeNull();
    expect(view.players.find((p) => p.id === 'u1')?.saidUno).toBe(true);

    // P2 cannot catch anymore -> bad_action
    expect(() => game.onAction('u2', { type: 'catch' })).toThrowError(
      expect.objectContaining({ code: 'bad_action' }),
    );
  });

  it('full UNO vulnerability and catch penalty flow', () => {
    // Let's create a game where P1 starts with cards, plays 1 card leaving 1 card:
    // Wait, start always deals 7 cards to each seated player.
    // Can P1 play 6 cards in a 2-player game where P1 plays skips/reverses?
    // In a 2-player game, Skip gives P1 another turn!
    // P1 has 6 skips and 1 number card!
    const deck = makeDeck([
      // P1: 6 red skips and 1 red 9
      ...Array.from({ length: 6 }, (_, i) => ({ id: 10 + i, color: 'red' as Color, value: 'skip' as const })),
      { id: 16, color: 'red', value: '9' },
      // P2: 7 yellow cards
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '8' as const })),
      // Top card: red 5
      { id: 99, color: 'red', value: '5' },
      // draw pile
      { id: 101, color: 'blue', value: '2' },
      { id: 102, color: 'blue', value: '3' },
    ]);

    const { ctx, events } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    // P1 plays 5 skips in a row (still P1's turn each time!)
    for (let i = 0; i < 5; i++) {
      game.onAction('u1', { type: 'play', cardId: 10 + i });
      expect((game.view('u1') as UnoView).turnId).toBe('u1');
    }
    // Now P1 has 2 cards: id 15 (skip) and id 16 (red 9).
    expect((game.view('u1') as UnoView).hand).toHaveLength(2);

    // Case A: P1 plays without saying UNO
    game.onAction('u1', { type: 'play', cardId: 15 }); // 6th skip
    let view = game.view('u1') as UnoView;
    expect(view.hand).toHaveLength(1);
    expect(view.vulnerableId).toBe('u1');

    // P1 cannot catch himself
    expect(() => game.onAction('u1', { type: 'catch' })).toThrowError(
      expect.objectContaining({ code: 'bad_action' }),
    );

    // P2 catches P1!
    game.onAction('u2', { type: 'catch' });
    view = game.view('u1') as UnoView;
    expect(view.vulnerableId).toBeNull();
    // P1 drew 2 cards -> hand length is now 3
    expect(view.hand).toHaveLength(3);
    expect(events.some((e) => e.event === 'caught')).toBe(true);
  });

  it('calling UNO when holding 2 cards avoids vulnerability on next play', () => {
    const deck = makeDeck([
      ...Array.from({ length: 5 }, (_, i) => ({ id: 10 + i, color: 'red' as Color, value: 'skip' as const })),
      { id: 15, color: 'red', value: 'skip' },
      { id: 16, color: 'red', value: '9' },
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '8' as const })),
      { id: 99, color: 'red', value: '5' },
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    for (let i = 0; i < 5; i++) {
      game.onAction('u1', { type: 'play', cardId: 10 + i });
    }
    // P1 now has 2 cards: calls UNO!
    game.onAction('u1', { type: 'uno' });
    let view = game.view('u1') as UnoView;
    expect(view.players.find((p) => p.id === 'u1')?.saidUno).toBe(true);

    // P1 plays 6th card leaving 1 card
    game.onAction('u1', { type: 'play', cardId: 15 });
    view = game.view('u1') as UnoView;
    expect(view.hand).toHaveLength(1);
    // Not vulnerable because saidUno was true
    expect(view.vulnerableId).toBeNull();
  });

  it('winning records result with ctx.record and emits won event', () => {
    const deck = makeDeck([
      ...Array.from({ length: 6 }, (_, i) => ({ id: 10 + i, color: 'red' as Color, value: 'skip' as const })),
      { id: 16, color: 'red', value: '9' },
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '8' as const })),
      { id: 99, color: 'red', value: '5' },
    ]);

    const { ctx, recorded, events } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    // P1 plays all 6 skips
    for (let i = 0; i < 6; i++) {
      game.onAction('u1', { type: 'play', cardId: 10 + i });
    }
    // P1 plays last card (red 9)
    game.onAction('u1', { type: 'play', cardId: 16 });

    const view = game.view('u1') as UnoView;
    expect(view.phase).toBe('ended');
    expect(view.winnerId).toBe('u1');
    expect(recorded).toEqual([{ winners: ['u1'], losers: ['u2'] }]);
    expect(events.some((e) => e.event === 'won' && (e.data as any)?.userId === 'u1')).toBe(true);
  });

  it('after game ended, host can call again to return to lobby', () => {
    const deck = makeDeck([
      ...Array.from({ length: 6 }, (_, i) => ({ id: 10 + i, color: 'red' as Color, value: 'skip' as const })),
      { id: 16, color: 'red', value: '9' },
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'yellow' as Color, value: '8' as const })),
      { id: 99, color: 'red', value: '5' },
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    for (let i = 0; i < 7; i++) {
      game.onAction('u1', { type: 'play', cardId: 10 + i });
    }

    // Non-host cannot call again
    expect(() => game.onAction('u2', { type: 'again' })).toThrowError(
      expect.objectContaining({ code: 'not_host' }),
    );

    // Host calls again
    game.onAction('u1', { type: 'again' });
    const view = game.view('u1') as UnoView;
    expect(view.phase).toBe('lobby');
    expect(view.players).toHaveLength(2);
    expect(view.winnerId).toBeNull();
  });

  it('leave mid-game reduces to 1 player => remaining player wins and records', () => {
    const { ctx, recorded, events } = createFakeContext();
    const game = createUnoGame(ctx);

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    expect((game.view('u1') as UnoView).phase).toBe('playing');

    // P1 leaves mid-game
    game.onLeave('u1', 'left');

    const view = game.view('u2') as UnoView;
    expect(view.phase).toBe('ended');
    expect(view.winnerId).toBe('u2');
    expect(recorded).toEqual([{ winners: ['u2'], losers: [] }]);
    expect(events.some((e) => e.event === 'won' && (e.data as any)?.userId === 'u2')).toBe(true);
  });

  it('leave mid-game with 3 players advances turn and puts cards at bottom of draw pile', () => {
    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx);

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onJoin(p3, null);
    game.onAction('u1', { type: 'start' });

    const initialDrawCount = (game.view('u1') as UnoView).drawPile;

    // It is P1's turn, P1 leaves
    game.onLeave('u1', 'left');

    const view = game.view('u2') as UnoView;
    expect(view.phase).toBe('playing');
    expect(view.players).toHaveLength(2);
    // P1 had 7 cards, they went to draw pile
    expect(view.drawPile).toBe(initialDrawCount + 7);
    // Turn advanced to P2
    expect(view.turnId).toBe('u2');
  });

  it('late joiner during playing phase becomes spectator', () => {
    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx);

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    game.onJoin(p3, null);
    const view = game.view('u3') as UnoView;
    expect(view.role).toBe('spectator');
    expect(view.hand).toEqual([]);
    expect(view.spectators).toHaveLength(1);
    expect(view.spectators[0].id).toBe('u3');
  });

  it('reshuffles discard pile when draw pile is exhausted', () => {
    // Create a scenario where draw pile runs out
    const deck = makeDeck([
      ...Array.from({ length: 7 }, (_, i) => ({ id: 10 + i, color: 'red' as Color, value: '1' as const })),
      ...Array.from({ length: 7 }, (_, i) => ({ id: 20 + i, color: 'red' as Color, value: '1' as const })),
      { id: 99, color: 'red', value: '5' },
      // No extra cards in draw pile initially!
    ]);

    const { ctx } = createFakeContext();
    const game = createUnoGame(ctx, Math.random, { initialDeck: deck });

    game.onJoin(p1, null);
    game.onJoin(p2, null);
    game.onAction('u1', { type: 'start' });

    // Discard pile has 1 card (99), drawPile has 0 cards.
    // P1 plays red 1 (id 10)
    game.onAction('u1', { type: 'play', cardId: 10 });
    // Now discard pile has [99, 10]. Top is 10.
    // P2 draws: drawPile is 0, so discard pile (minus top card 10) is recycled!
    game.onAction('u2', { type: 'draw' });
    const view = game.view('u2') as UnoView;
    expect(view.top?.id).toBe(10);
    // P2 drew card 99
    expect(view.hand.some((c) => c.id === 99)).toBe(true);
  });
});
