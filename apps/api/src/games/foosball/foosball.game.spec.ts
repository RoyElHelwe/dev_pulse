import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GamePlayerRef } from '../game.types';
import { GameError } from '../game.types';
import { createFoosballGame, type FoosballView, GRACE_MS } from './foosball.game';

describe('Foosball Game', () => {
  let pA1: GamePlayerRef;
  let pA2: GamePlayerRef;
  let pB1: GamePlayerRef;
  let pB2: GamePlayerRef;
  let spectator: GamePlayerRef;
  let participants: GamePlayerRef[];
  let ctx: any;

  beforeEach(() => {
    vi.useFakeTimers();

    pA1 = { userId: 'uA1', name: 'Alice', character: 'maya' };
    pA2 = { userId: 'uA2', name: 'Adam', character: 'alex' };
    pB1 = { userId: 'uB1', name: 'Bob', character: 'sam' };
    pB2 = { userId: 'uB2', name: 'Beth', character: 'ash' };
    spectator = { userId: 'uSpec', name: 'Charlie', character: 'liam' };

    participants = [pA1, pA2, pB1, pB2, spectator];

    ctx = {
      workspaceId: 'ws-1',
      objectId: 'foosball-1',
      kind: 'foosball',
      participants: vi.fn(() => participants),
      emitState: vi.fn(),
      emitEvent: vi.fn(),
      record: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('sit/stand manages seats and enforces max 2 per side', () => {
    const game = createFoosballGame(ctx);

    // Sit on A
    game.onAction(pA1.userId, { type: 'sit', side: 'A' });
    let view = game.view(pA1.userId) as FoosballView;
    expect(view.seats.A.map((p) => p.userId)).toEqual([pA1.userId]);

    // Sit second player on A
    game.onAction(pA2.userId, { type: 'sit', side: 'A' });
    view = game.view(pA1.userId) as FoosballView;
    expect(view.seats.A.map((p) => p.userId)).toEqual([pA1.userId, pA2.userId]);

    // Third player attempting to sit on A throws SEAT_TAKEN
    expect(() => {
      game.onAction(spectator.userId, { type: 'sit', side: 'A' });
    }).toThrow(GameError);
    try {
      game.onAction(spectator.userId, { type: 'sit', side: 'A' });
    } catch (e: any) {
      expect(e.code).toBe('SEAT_TAKEN');
    }

    // Stand removes player
    game.onAction(pA1.userId, { type: 'stand' });
    view = game.view(pA1.userId) as FoosballView;
    expect(view.seats.A.map((p) => p.userId)).toEqual([pA2.userId]);

    game.dispose();
  });

  it('uneven start rejected with UNEVEN_TEAMS', () => {
    const game = createFoosballGame(ctx);

    // 0v0 start by non-seated throws NOT_SEATED
    expect(() => {
      game.onAction(pA1.userId, { type: 'start' });
    }).toThrow(GameError);

    // 1v0 (A=1, B=0)
    game.onAction(pA1.userId, { type: 'sit', side: 'A' });
    expect(() => {
      game.onAction(pA1.userId, { type: 'start' });
    }).toThrow(GameError);
    try {
      game.onAction(pA1.userId, { type: 'start' });
    } catch (e: any) {
      expect(e.code).toBe('UNEVEN_TEAMS');
    }

    // 2v1 (A=2, B=1)
    game.onAction(pA2.userId, { type: 'sit', side: 'A' });
    game.onAction(pB1.userId, { type: 'sit', side: 'B' });
    try {
      game.onAction(pA1.userId, { type: 'start' });
    } catch (e: any) {
      expect(e.code).toBe('UNEVEN_TEAMS');
    }

    game.dispose();
  });

  it('start -> countdown -> playing with fake timers', () => {
    const game = createFoosballGame(ctx);

    // 1v1
    game.onAction(pA1.userId, { type: 'sit', side: 'A' });
    game.onAction(pB1.userId, { type: 'sit', side: 'B' });

    game.onAction(pA1.userId, { type: 'start' });

    let view = game.view(pA1.userId) as FoosballView;
    expect(view.phase).toBe('countdown');
    expect(view.countdown).toBe(3);

    // Advance 1.5s
    vi.advanceTimersByTime(1500);
    view = game.view(pA1.userId) as FoosballView;
    expect(view.phase).toBe('countdown');
    expect(view.countdown).toBe(2);

    // Advance remaining to complete 3s countdown
    vi.advanceTimersByTime(1500);
    view = game.view(pA1.userId) as FoosballView;
    expect(view.phase).toBe('playing');
    expect(view.ball.vx).not.toBe(0); // Ball was served

    game.dispose();
  });

  it('score to 5 ends match + ctx.record called once with right winners/losers', () => {
    const game = createFoosballGame(ctx);

    game.onAction(pA1.userId, { type: 'sit', side: 'A' });
    game.onAction(pB1.userId, { type: 'sit', side: 'B' });
    game.onAction(pA1.userId, { type: 'start' });

    // Reach playing phase
    vi.advanceTimersByTime(3000);
    expect((game.view(pA1.userId) as FoosballView).phase).toBe('playing');

    // Simulate 4 goals for side A directly on score
    game._score.A = 4;

    // Put ball about to enter side B's goal (x > 120, y in opening)
    game._world.ball = { x: 119, y: 32, vx: 50, vy: 0 };

    // Advance by 1 tick (35ms)
    vi.advanceTimersByTime(35);

    const view = game.view(pA1.userId) as FoosballView;
    expect(view.phase).toBe('ended');
    expect(view.score.A).toBe(5);
    expect(view.winner).toBe('A');
    expect(view.forfeit).toBe(false);

    expect(ctx.record).toHaveBeenCalledTimes(1);
    expect(ctx.record).toHaveBeenCalledWith({
      winners: [pA1.userId],
      losers: [pB1.userId],
    });

    // Advance time further: ctx.record must not be called again
    vi.advanceTimersByTime(5000);
    expect(ctx.record).toHaveBeenCalledTimes(1);

    game.dispose();
  });

  it('forfeit after GRACE_MS with record', () => {
    const game = createFoosballGame(ctx);

    game.onAction(pA1.userId, { type: 'sit', side: 'A' });
    game.onAction(pB1.userId, { type: 'sit', side: 'B' });
    game.onAction(pA1.userId, { type: 'start' });
    vi.advanceTimersByTime(3000);

    // Player A leaves during match
    game.onLeave(pA1.userId, 'disconnected');

    let view = game.view(pB1.userId) as FoosballView;
    expect(view.seats.A[0].away).toBe(true);
    expect(view.graceLeft).toBe(10);

    // Advance 5s: still in grace
    vi.advanceTimersByTime(5000);
    view = game.view(pB1.userId) as FoosballView;
    expect(view.phase).toBe('playing');
    expect(view.graceLeft).toBe(5);
    expect(ctx.record).not.toHaveBeenCalled();

    // Advance remaining 5s to hit GRACE_MS
    vi.advanceTimersByTime(5000);

    view = game.view(pB1.userId) as FoosballView;
    expect(view.phase).toBe('ended');
    expect(view.winner).toBe('B');
    expect(view.forfeit).toBe(true);

    expect(ctx.record).toHaveBeenCalledTimes(1);
    expect(ctx.record).toHaveBeenCalledWith({
      winners: [pB1.userId],
      losers: [pA1.userId],
    });
    expect(ctx.emitEvent).toHaveBeenCalledWith('forfeit', { side: 'A' });

    game.dispose();
  });

  it('reconnect within grace cancels it', () => {
    const game = createFoosballGame(ctx);

    game.onAction(pA1.userId, { type: 'sit', side: 'A' });
    game.onAction(pB1.userId, { type: 'sit', side: 'B' });
    game.onAction(pA1.userId, { type: 'start' });
    vi.advanceTimersByTime(3000);

    // Player A leaves
    game.onLeave(pA1.userId, 'disconnected');
    expect((game.view(pB1.userId) as FoosballView).graceLeft).toBe(10);

    // Advance 4s
    vi.advanceTimersByTime(4000);

    // Player A reconnects
    game.onJoin(pA1, null);

    const view = game.view(pB1.userId) as FoosballView;
    expect(view.seats.A[0].away).toBe(false);
    expect(view.graceLeft).toBeNull();

    // Advance past original grace expiration
    vi.advanceTimersByTime(10000);

    // Match is still playing, no forfeit
    const viewAfter = game.view(pB1.userId) as FoosballView;
    expect(viewAfter.phase).toBe('playing');
    expect(ctx.record).not.toHaveBeenCalled();

    game.dispose();
  });

  it('spectator move and kick rejected NOT_SEATED', () => {
    const game = createFoosballGame(ctx);

    game.onAction(pA1.userId, { type: 'sit', side: 'A' });
    game.onAction(pB1.userId, { type: 'sit', side: 'B' });
    game.onAction(pA1.userId, { type: 'start' });
    vi.advanceTimersByTime(3000);

    // Spectator sends move
    try {
      game.onAction(spectator.userId, { type: 'move', rod: 0, dir: 1 });
      expect.fail('Should throw NOT_SEATED');
    } catch (e: any) {
      expect(e.code).toBe('NOT_SEATED');
    }

    // Spectator sends kick
    try {
      game.onAction(spectator.userId, { type: 'kick', rod: 0 });
      expect.fail('Should throw NOT_SEATED');
    } catch (e: any) {
      expect(e.code).toBe('NOT_SEATED');
    }

    game.dispose();
  });

  it('2v2 rod ownership partitions rods and transfers on teammate absence', () => {
    const game = createFoosballGame(ctx);

    // 2v2 setup
    game.onAction(pA1.userId, { type: 'sit', side: 'A' });
    game.onAction(pA2.userId, { type: 'sit', side: 'A' });
    game.onAction(pB1.userId, { type: 'sit', side: 'B' });
    game.onAction(pB2.userId, { type: 'sit', side: 'B' });

    let viewA1 = game.view(pA1.userId) as FoosballView;
    let viewA2 = game.view(pA2.userId) as FoosballView;
    expect(viewA1.you?.rods).toEqual([0, 1]);
    expect(viewA2.you?.rods).toEqual([2, 3]);

    game.onAction(pA1.userId, { type: 'start' });
    vi.advanceTimersByTime(3000);

    // pA1 cannot move rod 2 (owned by pA2)
    expect(() => {
      game.onAction(pA1.userId, { type: 'move', rod: 2, dir: 1 });
    }).toThrow(GameError);
    try {
      game.onAction(pA1.userId, { type: 'move', rod: 2, dir: 1 });
    } catch (e: any) {
      expect(e.code).toBe('NOT_YOUR_ROD');
    }

    // pA1 can move rod 0
    game.onAction(pA1.userId, { type: 'move', rod: 0, dir: 1 });
    expect(game._world.rods.A[0].dir).toBe(1);

    // pA2 goes away
    game.onLeave(pA2.userId, 'disconnected');

    // Partner pA1 now inherits all rods [0, 1, 2, 3]
    viewA1 = game.view(pA1.userId) as FoosballView;
    expect(viewA1.you?.rods).toEqual([0, 1, 2, 3]);

    // pA1 can now move rod 2 without error
    game.onAction(pA1.userId, { type: 'move', rod: 2, dir: -1 });
    expect(game._world.rods.A[2].dir).toBe(-1);

    game.dispose();
  });

  it('rematch resets state to lobby keeping seats', () => {
    const game = createFoosballGame(ctx);

    game.onAction(pA1.userId, { type: 'sit', side: 'A' });
    game.onAction(pB1.userId, { type: 'sit', side: 'B' });
    game.onAction(pA1.userId, { type: 'start' });
    vi.advanceTimersByTime(3000);

    // Score 5 to end match
    game._score.A = 4;
    game._world.ball = { x: 119, y: 32, vx: 50, vy: 0 };
    vi.advanceTimersByTime(35);

    let view = game.view(pA1.userId) as FoosballView;
    expect(view.phase).toBe('ended');
    expect(view.winner).toBe('A');

    // Rematch
    game.onAction(pA1.userId, { type: 'rematch' });

    view = game.view(pA1.userId) as FoosballView;
    expect(view.phase).toBe('lobby');
    expect(view.score).toEqual({ A: 0, B: 0 });
    expect(view.winner).toBeNull();
    expect(view.forfeit).toBe(false);
    expect(view.seats.A.map((p) => p.userId)).toEqual([pA1.userId]);
    expect(view.seats.B.map((p) => p.userId)).toEqual([pB1.userId]);

    game.dispose();
  });

  it('dispose clears timers (vi.getTimerCount() === 0)', () => {
    const game = createFoosballGame(ctx);

    game.onAction(pA1.userId, { type: 'sit', side: 'A' });
    game.onAction(pB1.userId, { type: 'sit', side: 'B' });
    game.onAction(pA1.userId, { type: 'start' });

    // During countdown/playing, tickInterval is active
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // Also trigger grace timer
    vi.advanceTimersByTime(3000);
    game.onLeave(pA1.userId, 'disconnected');
    expect(vi.getTimerCount()).toBeGreaterThan(1);

    // Dispose
    game.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('view() has correct you field for spectators and players', () => {
    const game = createFoosballGame(ctx);

    game.onAction(pA1.userId, { type: 'sit', side: 'A' });
    game.onAction(pB1.userId, { type: 'sit', side: 'B' });

    // Spectator view
    const viewSpec = game.view(spectator.userId) as FoosballView;
    expect(viewSpec.you).toBeNull();
    expect(viewSpec.spectators).toBe(3); // pA2, pB2, spectator

    // Seated A view (1v1: all rods)
    const viewA = game.view(pA1.userId) as FoosballView;
    expect(viewA.you).toEqual({ side: 'A', rods: [0, 1, 2, 3] });

    // Seated B view (1v1: all rods)
    const viewB = game.view(pB1.userId) as FoosballView;
    expect(viewB.you).toEqual({ side: 'B', rods: [0, 1, 2, 3] });

    game.dispose();
  });
});
