import type { GameContext, GameInstance, GamePlayerRef } from '../game.types';
import { GameError } from '../game.types';
import {
  createInitialWorld,
  FIELD_L,
  FIELD_W,
  type PhysicsWorld,
  ROD_SPEED,
  step,
  TARGET,
  TICK_RATE,
  triggerKick,
} from './foosball.physics';

export const GRACE_MS = 10000;

export interface Player {
  userId: string;
  name: string;
  character: string;
  away?: boolean;
}

export interface RodView {
  y: number;
  kick: number;
}

export interface FoosballView {
  phase: 'lobby' | 'countdown' | 'playing' | 'goal' | 'ended';
  target: 5;
  score: { A: number; B: number };
  seats: { A: Player[]; B: Player[] };
  spectators: number;
  you: { side: 'A' | 'B'; rods: number[] } | null;
  ball: { x: number; y: number; vx: number; vy: number };
  rods: { A: RodView[]; B: RodView[] };
  countdown: number;
  winner: 'A' | 'B' | null;
  forfeit: boolean;
  graceLeft: number | null;
  now: number;
}

export function createFoosballGame(
  ctx: GameContext,
  opts?: { now?: () => number },
): GameInstance & { _world: PhysicsWorld; _score: { A: number; B: number } } {
  const now = opts?.now ?? (() => Date.now());

  let phase: FoosballView['phase'] = 'lobby';
  const score = { A: 0, B: 0 };
  const seats: { A: Player[]; B: Player[] } = { A: [], B: [] };
  let winner: 'A' | 'B' | null = null;
  let forfeit = false;
  let recordCalled = false;
  let disposed = false;

  let world: PhysicsWorld = createInitialWorld();

  let tickInterval: NodeJS.Timeout | undefined;
  let countdownTimeout: NodeJS.Timeout | undefined;
  let goalTimeout: NodeJS.Timeout | undefined;
  let countdownEndsAt = 0;
  let goalEndsAt = 0;

  let graceTimeout: NodeJS.Timeout | undefined;
  let graceExpiresAt: number | null = null;
  let graceSide: 'A' | 'B' | null = null;

  function stopTickLoop(): void {
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = undefined;
    }
  }

  function startTickLoop(): void {
    if (!tickInterval) {
      tickInterval = setInterval(() => {
        tick();
      }, 1000 / TICK_RATE);
    }
  }

  function clearPhaseTimeouts(): void {
    if (countdownTimeout) {
      clearTimeout(countdownTimeout);
      countdownTimeout = undefined;
    }
    if (goalTimeout) {
      clearTimeout(goalTimeout);
      goalTimeout = undefined;
    }
  }

  function getPlayerSide(userId: string): 'A' | 'B' | null {
    if (seats.A.some((p) => p.userId === userId)) return 'A';
    if (seats.B.some((p) => p.userId === userId)) return 'B';
    return null;
  }

  function getPlayerOwnedRods(side: 'A' | 'B', userId: string): number[] {
    const team = seats[side];
    const idx = team.findIndex((p) => p.userId === userId);
    if (idx === -1) return [];

    const presentPlayers = team.filter((p) => !p.away);

    // In 1v1, or if partner is away during match, the present player controls all rods
    if (team.length <= 1 || presentPlayers.length === 1) {
      if (!team[idx].away) {
        return [0, 1, 2, 3];
      }
    }

    if (idx === 0) return [0, 1];
    if (idx === 1) return [2, 3];
    return [];
  }

  function recordMatchResult(winnerSide: 'A' | 'B', loserSide: 'A' | 'B'): void {
    if (recordCalled) return;
    recordCalled = true;
    const winners = seats[winnerSide].map((p) => p.userId);
    const losers = seats[loserSide].map((p) => p.userId);
    void ctx.record({ winners, losers });
  }

  function handleGraceExpiry(): void {
    graceTimeout = undefined;
    graceExpiresAt = null;
    const fSide = graceSide;
    graceSide = null;
    if (!fSide) return;

    const wSide: 'A' | 'B' = fSide === 'A' ? 'B' : 'A';
    phase = 'ended';
    winner = wSide;
    forfeit = true;
    stopTickLoop();
    clearPhaseTimeouts();

    recordMatchResult(wSide, fSide);
    ctx.emitEvent('forfeit', { side: fSide });
    ctx.emitState();
  }

  function checkSessionClose(): void {
    const allSeated = [...seats.A, ...seats.B];
    const anyPresentSeated = allSeated.some((p) => !p.away);
    if (!anyPresentSeated) {
      const participants = ctx.participants();
      const spectators = participants.filter((p) => !allSeated.some((s) => s.userId === p.userId));
      if (spectators.length === 0) {
        ctx.close();
      }
    }
  }

  function serveBall(): void {
    world.ball.x = FIELD_L / 2;
    world.ball.y = FIELD_W / 2;
    world.ball.vx = 25;
    world.ball.vy = 0;
    world.stuckTimer = 0;
  }

  function startCountdown(): void {
    phase = 'countdown';
    countdownEndsAt = now() + 3000;
    clearPhaseTimeouts();
    countdownTimeout = setTimeout(() => {
      countdownTimeout = undefined;
      phase = 'playing';
      serveBall();
      ctx.emitState();
    }, 3000);
    startTickLoop();
    ctx.emitState();
  }

  function tick(): void {
    if (disposed) return;

    if (phase === 'countdown' || phase === 'goal') {
      ctx.emitState();
      return;
    }

    if (phase === 'playing') {
      const res = step(world, 1 / TICK_RATE);
      for (const ev of res.events) {
        if (ev.type === 'bounce') {
          ctx.emitEvent('bounce');
        } else if (ev.type === 'kick') {
          ctx.emitEvent('kick', { side: ev.side, rod: ev.rod });
        }
      }

      if (res.goal) {
        const scoringSide = res.goal;
        score[scoringSide] += 1;
        ctx.emitEvent('goal', { side: scoringSide });

        if (score[scoringSide] >= TARGET) {
          phase = 'ended';
          winner = scoringSide;
          forfeit = false;
          stopTickLoop();
          clearPhaseTimeouts();
          recordMatchResult(scoringSide, scoringSide === 'A' ? 'B' : 'A');
          ctx.emitState();
          return;
        }

        phase = 'goal';
        goalEndsAt = now() + 1500;
        world.ball.x = FIELD_L / 2;
        world.ball.y = FIELD_W / 2;
        world.ball.vx = 0;
        world.ball.vy = 0;
        for (const side of ['A', 'B'] as const) {
          for (const r of world.rods[side]) {
            r.dir = 0;
          }
        }

        clearPhaseTimeouts();
        goalTimeout = setTimeout(() => {
          goalTimeout = undefined;
          startCountdown();
        }, 1500);

        ctx.emitState();
        return;
      }

      ctx.emitState();
    }
  }

  return {
    get _world() {
      return world;
    },
    get _score() {
      return score;
    },

    onJoin(p: GamePlayerRef, _intent: unknown): void {
      if (disposed) return;

      const seatedA = seats.A.find((x) => x.userId === p.userId);
      const seatedB = seats.B.find((x) => x.userId === p.userId);
      const seated = seatedA || seatedB;

      if (seated) {
        seated.away = false;
        const side = seatedA ? 'A' : 'B';
        if (graceSide === side) {
          if (graceTimeout) {
            clearTimeout(graceTimeout);
            graceTimeout = undefined;
          }
          graceExpiresAt = null;
          graceSide = null;
        }
      }

      ctx.emitState();
    },

    onLeave(userId: string, _reason: 'left' | 'far' | 'disconnected'): void {
      if (disposed) return;

      const side = getPlayerSide(userId);
      if (!side) {
        checkSessionClose();
        return;
      }

      if (phase === 'lobby' || phase === 'ended') {
        const idx = seats[side].findIndex((p) => p.userId === userId);
        if (idx !== -1) {
          seats[side].splice(idx, 1);
        }
        ctx.emitState();
        checkSessionClose();
        return;
      }

      // During match: mark player away
      const player = seats[side].find((p) => p.userId === userId);
      if (player) {
        player.away = true;
      }

      // If no present player remains on that side, start grace timer
      const hasPresentPlayer = seats[side].some((p) => !p.away);
      if (!hasPresentPlayer && graceTimeout === undefined) {
        graceSide = side;
        graceExpiresAt = now() + GRACE_MS;
        graceTimeout = setTimeout(() => {
          handleGraceExpiry();
        }, GRACE_MS);
      }

      ctx.emitState();
      checkSessionClose();
    },

    onAction(userId: string, action: unknown): void {
      if (disposed) return;
      if (!action || typeof action !== 'object' || !('type' in action)) {
        throw new GameError('BAD_ACTION', 'Action must have a type');
      }

      const act = action as { type: string; [key: string]: unknown };

      switch (act.type) {
        case 'sit': {
          if (phase !== 'lobby' && phase !== 'ended') {
            throw new GameError('BAD_PHASE', 'Can only sit in lobby or ended phase');
          }
          const side = act.side;
          if (side !== 'A' && side !== 'B') {
            throw new GameError('BAD_ACTION', 'Side must be A or B');
          }

          const currentSide = getPlayerSide(userId);
          if (currentSide === side) {
            return;
          }

          if (seats[side].length >= 2) {
            throw new GameError('SEAT_TAKEN', `Side ${side} is full`);
          }

          if (currentSide) {
            const oldIdx = seats[currentSide].findIndex((p) => p.userId === userId);
            if (oldIdx !== -1) seats[currentSide].splice(oldIdx, 1);
          }

          const pRef = ctx.participants().find((p) => p.userId === userId);
          seats[side].push({
            userId,
            name: pRef?.name ?? 'Player',
            character: pRef?.character ?? 'default',
          });
          ctx.emitState();
          break;
        }

        case 'stand': {
          if (phase !== 'lobby' && phase !== 'ended') {
            throw new GameError('BAD_PHASE', 'Can only stand in lobby or ended phase');
          }
          const currentSide = getPlayerSide(userId);
          if (currentSide) {
            const idx = seats[currentSide].findIndex((p) => p.userId === userId);
            if (idx !== -1) seats[currentSide].splice(idx, 1);
            ctx.emitState();
          }
          break;
        }

        case 'start': {
          if (phase !== 'lobby') {
            throw new GameError('BAD_PHASE', 'Can only start from lobby');
          }
          const side = getPlayerSide(userId);
          if (!side) {
            throw new GameError('NOT_SEATED', 'Only seated players can start');
          }
          if (seats.A.length !== seats.B.length || seats.A.length === 0) {
            throw new GameError('UNEVEN_TEAMS', 'Start requires equal counts on both sides (1v1 or 2v2)');
          }

          score.A = 0;
          score.B = 0;
          winner = null;
          forfeit = false;
          recordCalled = false;
          world = createInitialWorld();

          startCountdown();
          break;
        }

        case 'rematch': {
          if (phase !== 'ended') {
            throw new GameError('BAD_PHASE', 'Can only rematch when ended');
          }
          const side = getPlayerSide(userId);
          if (!side) {
            throw new GameError('NOT_SEATED', 'Only seated players can rematch');
          }

          phase = 'lobby';
          score.A = 0;
          score.B = 0;
          winner = null;
          forfeit = false;
          recordCalled = false;
          graceExpiresAt = null;
          graceSide = null;
          stopTickLoop();
          clearPhaseTimeouts();

          world = createInitialWorld();
          for (const p of seats.A) p.away = false;
          for (const p of seats.B) p.away = false;

          ctx.emitState();
          break;
        }

        case 'move': {
          const side = getPlayerSide(userId);
          if (!side) {
            throw new GameError('NOT_SEATED', 'Only seated players can move rods');
          }
          const rod = act.rod;
          if (typeof rod !== 'number' || rod < 0 || rod > 3 || !Number.isInteger(rod)) {
            throw new GameError('BAD_ACTION', 'Invalid rod index');
          }
          const dir = act.dir;
          if (dir !== -1 && dir !== 0 && dir !== 1) {
            throw new GameError('BAD_ACTION', 'Invalid dir');
          }

          const owned = getPlayerOwnedRods(side, userId);
          if (!owned.includes(rod)) {
            throw new GameError('NOT_YOUR_ROD', 'Not your rod');
          }

          if (phase !== 'playing') {
            throw new GameError('BAD_PHASE', 'Can only move rods during playing phase');
          }

          world.rods[side][rod].dir = dir;
          break;
        }

        case 'kick': {
          const side = getPlayerSide(userId);
          if (!side) {
            throw new GameError('NOT_SEATED', 'Only seated players can kick rods');
          }
          const rod = act.rod;
          if (typeof rod !== 'number' || rod < 0 || rod > 3 || !Number.isInteger(rod)) {
            throw new GameError('BAD_ACTION', 'Invalid rod index');
          }

          const owned = getPlayerOwnedRods(side, userId);
          if (!owned.includes(rod)) {
            throw new GameError('NOT_YOUR_ROD', 'Not your rod');
          }

          if (phase !== 'playing') {
            throw new GameError('BAD_PHASE', 'Can only kick during playing phase');
          }

          if (triggerKick(world, side, rod)) {
            ctx.emitEvent('kick', { side, rod });
          }
          break;
        }

        default:
          throw new GameError('BAD_ACTION', `Unknown action type: ${act.type}`);
      }
    },

    view(userId: string): FoosballView {
      const side = getPlayerSide(userId);
      const you = side ? { side, rods: getPlayerOwnedRods(side, userId) } : null;

      const seatedIds = new Set([...seats.A, ...seats.B].map((p) => p.userId));
      const spectators = ctx.participants().filter((p) => !seatedIds.has(p.userId)).length;

      let countdown = 0;
      if (phase === 'countdown') {
        countdown = Math.max(0, Math.ceil((countdownEndsAt - now()) / 1000));
      }

      let graceLeft: number | null = null;
      if (graceExpiresAt !== null) {
        graceLeft = Math.max(0, Math.ceil((graceExpiresAt - now()) / 1000));
      }

      return {
        phase,
        target: TARGET,
        score: { ...score },
        seats: {
          A: seats.A.map((p) => ({ ...p })),
          B: seats.B.map((p) => ({ ...p })),
        },
        spectators,
        you,
        ball: { ...world.ball },
        rods: {
          A: world.rods.A.map((r) => ({ y: r.y, kick: r.kick })),
          B: world.rods.B.map((r) => ({ y: r.y, kick: r.kick })),
        },
        countdown,
        winner,
        forfeit,
        graceLeft,
        now: now(),
      };
    },

    dispose(): void {
      disposed = true;
      stopTickLoop();
      clearPhaseTimeouts();
      if (graceTimeout) {
        clearTimeout(graceTimeout);
        graceTimeout = undefined;
      }
    },
  };
}
