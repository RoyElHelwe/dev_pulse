/**
 * Foosball game session wiring and match orchestration.
 * Connects state, simulation tick loops, client actions, view projections, and disconnect grace.
 */

import type { GameContext, GameInstance, GamePlayerRef } from '../game.types';
import { GameError } from '../game.types';
import { FIELD_L, FIELD_W, type PhysicsWorld, step, TARGET, TICK_RATE } from './foosball.physics';
import {
  handleAimAction,
  handleKickAction,
  handleMoveAction,
  handleRematchAction,
  handleSitAction,
  handleStandAction,
  handleStartAction,
  ROD_DIR_STOP_VALUE,
} from './foosball.actions';
import {
  checkSessionClose,
  createInitialFoosballState,
  type FoosballPhase,
  type FoosballSeats,
  type FoosballSide,
  type FoosballState,
  type FoosballView,
  getPlayerOwnedRods,
  getPlayerSide,
  hasPresentPlayer,
  MIN_COUNTDOWN_SECONDS,
  MIN_GRACE_SECONDS,
  type Player,
  removePlayerFromSide,
  type RodView,
} from './foosball.roster';

export type { FoosballView };

// ============================================================================
// Constants and Timing Configurations
// ============================================================================

/** Disconnect grace period before forfeited match ends (milliseconds). */
export const GRACE_MS = 10000;

/** Match start countdown delay (milliseconds). */
const COUNTDOWN_DURATION_MS = 3000;

/** Delay after a goal before re-entering countdown (milliseconds). */
const GOAL_RESET_DELAY_MS = 1500;

/** Milliseconds per second conversion factor. */
const MS_PER_SECOND = 1000;

/** Interval between simulation ticks (milliseconds, ~33.3ms for 30 Hz). */
const TICK_INTERVAL_MS = MS_PER_SECOND / TICK_RATE;

/** Simulation delta time per physics step (seconds). */
const SECONDS_PER_TICK = 1 / TICK_RATE;

/** Initial ball velocity imparted along X on serve (units/s). */
const SERVE_BALL_SPEED_UNITS_PER_S = 25;

/** Stopped ball velocity along coordinate axes (units/s). */
const BALL_STOPPED_VELOCITY_UNITS_PER_S = 0;

/** Stuck timer reset value in seconds. */
const BALL_RESET_STUCK_TIMER_S = 0;

/** Divisor for centering objects on field axes. */
const FIELD_CENTER_DIVISOR = 2;

// ============================================================================
// Simulation Loop and Timer Helpers
// ============================================================================

/** Halts active physics simulation interval if running. */
function stopTickLoop(state: FoosballState): void {
  if (state.tickInterval) {
    clearInterval(state.tickInterval);
    state.tickInterval = undefined;
  }
}

/** Starts the 30 Hz physics tick interval loop. */
function startTickLoop(state: FoosballState, ctx: GameContext): void {
  if (!state.tickInterval) {
    state.tickInterval = setInterval(() => {
      tick(state, ctx);
    }, TICK_INTERVAL_MS);
  }
}

/** Clears countdown and goal reset timeouts if active. */
function clearPhaseTimeouts(state: FoosballState): void {
  if (state.countdownTimeout) {
    clearTimeout(state.countdownTimeout);
    state.countdownTimeout = undefined;
  }
  if (state.goalTimeout) {
    clearTimeout(state.goalTimeout);
    state.goalTimeout = undefined;
  }
}

// ============================================================================
// Match Progression Helpers
// ============================================================================

/** Resets ball to center pitch with initial serve velocity. */
function serveBall(world: PhysicsWorld): void {
  world.ball.x = FIELD_L / FIELD_CENTER_DIVISOR;
  world.ball.y = FIELD_W / FIELD_CENTER_DIVISOR;
  world.ball.vx = SERVE_BALL_SPEED_UNITS_PER_S;
  world.ball.vy = BALL_STOPPED_VELOCITY_UNITS_PER_S;
  world.stuckTimer = BALL_RESET_STUCK_TIMER_S;
}

/** Records match outcome in PostgreSQL leaderboard if not already recorded. */
function recordMatchResult(
  state: FoosballState,
  ctx: GameContext,
  winnerSide: FoosballSide,
  loserSide: FoosballSide,
): void {
  if (state.recordCalled) return;
  state.recordCalled = true;
  const winners = state.seats[winnerSide].map((p) => p.userId);
  const losers = state.seats[loserSide].map((p) => p.userId);
  void ctx.record({ winners, losers });
}

/** Handles expiration of grace period when an entire team abandons the match. */
function handleGraceExpiry(state: FoosballState, ctx: GameContext): void {
  state.graceTimeout = undefined;
  state.graceExpiresAt = null;
  const fSide = state.graceSide;
  state.graceSide = null;
  if (!fSide) return;

  const wSide: FoosballSide = fSide === 'A' ? 'B' : 'A';
  state.phase = 'ended';
  state.winner = wSide;
  state.forfeit = true;
  stopTickLoop(state);
  clearPhaseTimeouts(state);

  recordMatchResult(state, ctx, wSide, fSide);
  ctx.emitEvent('forfeit', { side: fSide });
  ctx.emitState();
}

/** Transitions state into countdown phase and schedules serve transition. */
function startCountdown(state: FoosballState, ctx: GameContext): void {
  state.phase = 'countdown';
  state.countdownEndsAt = state.now() + COUNTDOWN_DURATION_MS;
  clearPhaseTimeouts(state);
  state.countdownTimeout = setTimeout(() => {
    state.countdownTimeout = undefined;
    state.phase = 'playing';
    serveBall(state.world);
    ctx.emitState();
  }, COUNTDOWN_DURATION_MS);
  startTickLoop(state, ctx);
  ctx.emitState();
}

/** Handles ball entering goal opening, checking win condition or scheduling reset. */
function handleGoalScored(
  state: FoosballState,
  ctx: GameContext,
  scoringSide: FoosballSide,
): void {
  state.score[scoringSide] += 1;
  ctx.emitEvent('goal', { side: scoringSide });

  if (state.score[scoringSide] >= TARGET) {
    state.phase = 'ended';
    state.winner = scoringSide;
    state.forfeit = false;
    stopTickLoop(state);
    clearPhaseTimeouts(state);
    recordMatchResult(state, ctx, scoringSide, scoringSide === 'A' ? 'B' : 'A');
    ctx.emitState();
    return;
  }

  state.phase = 'goal';
  state.goalEndsAt = state.now() + GOAL_RESET_DELAY_MS;
  state.world.ball.x = FIELD_L / FIELD_CENTER_DIVISOR;
  state.world.ball.y = FIELD_W / FIELD_CENTER_DIVISOR;
  state.world.ball.vx = BALL_STOPPED_VELOCITY_UNITS_PER_S;
  state.world.ball.vy = BALL_STOPPED_VELOCITY_UNITS_PER_S;
  for (const side of ['A', 'B'] as const) {
    for (const r of state.world.rods[side]) {
      r.dir = ROD_DIR_STOP_VALUE;
      r.target = null;
    }
  }

  clearPhaseTimeouts(state);
  state.goalTimeout = setTimeout(() => {
    state.goalTimeout = undefined;
    startCountdown(state, ctx);
  }, GOAL_RESET_DELAY_MS);

  ctx.emitState();
}

/** Executes one 30 Hz simulation step advancing ball kinematics and collision responses. */
function tick(state: FoosballState, ctx: GameContext): void {
  if (state.disposed) return;

  if (state.phase === 'countdown' || state.phase === 'goal') {
    ctx.emitState();
    return;
  }

  if (state.phase === 'playing') {
    const res = step(state.world, SECONDS_PER_TICK);
    for (const ev of res.events) {
      if (ev.type === 'bounce') {
        ctx.emitEvent('bounce');
      } else if (ev.type === 'kick') {
        ctx.emitEvent('kick', { side: ev.side, rod: ev.rod });
      }
    }

    if (res.goal) {
      handleGoalScored(state, ctx, res.goal);
      return;
    }

    ctx.emitState();
  }
}

// ============================================================================
// Lifecycle Handlers
// ============================================================================

/** Handles a user joining the table or reconnecting to cancel team grace forfeit. */
function handleJoin(state: FoosballState, ctx: GameContext, p: GamePlayerRef): void {
  if (state.disposed) return;

  const seatedA = state.seats.A.find((x) => x.userId === p.userId);
  const seatedB = state.seats.B.find((x) => x.userId === p.userId);
  const seated = seatedA || seatedB;

  if (seated) {
    seated.away = false;
    const side: FoosballSide = seatedA ? 'A' : 'B';
    if (state.graceSide === side) {
      if (state.graceTimeout) {
        clearTimeout(state.graceTimeout);
        state.graceTimeout = undefined;
      }
      state.graceExpiresAt = null;
      state.graceSide = null;
    }
  }

  ctx.emitState();
}

/** Handles a user leaving the table, starting disconnect grace timer if side is empty. */
function handleLeave(state: FoosballState, ctx: GameContext, userId: string): void {
  if (state.disposed) return;

  const side = getPlayerSide(state.seats, userId);
  if (!side) {
    checkSessionClose(state.seats, ctx);
    return;
  }

  if (state.phase === 'lobby' || state.phase === 'ended') {
    removePlayerFromSide(state.seats, side, userId);
    ctx.emitState();
    checkSessionClose(state.seats, ctx);
    return;
  }

  const player = state.seats[side].find((p) => p.userId === userId);
  if (player) {
    player.away = true;
  }

  const hasPresent = hasPresentPlayer(state.seats, side);
  if (!hasPresent && state.graceTimeout === undefined) {
    state.graceSide = side;
    state.graceExpiresAt = state.now() + GRACE_MS;
    state.graceTimeout = setTimeout(() => {
      handleGraceExpiry(state, ctx);
    }, GRACE_MS);
  }

  ctx.emitState();
  checkSessionClose(state.seats, ctx);
}

/** Dispatches client action to dedicated action handlers. */
function dispatchAction(
  state: FoosballState,
  ctx: GameContext,
  userId: string,
  action: unknown,
): void {
  if (state.disposed) return;
  if (!action || typeof action !== 'object' || !('type' in action)) {
    throw new GameError('BAD_ACTION', 'Action must have a type');
  }

  const act = action as { type: string; [key: string]: unknown };

  switch (act.type) {
    case 'sit':
      handleSitAction(state, ctx, userId, act);
      break;
    case 'stand':
      handleStandAction(state, ctx, userId);
      break;
    case 'start':
      handleStartAction(state, ctx, userId, () => startCountdown(state, ctx));
      break;
    case 'rematch':
      handleRematchAction(state, ctx, userId, () => {
        stopTickLoop(state);
        clearPhaseTimeouts(state);
      });
      break;
    case 'aim':
      handleAimAction(state, ctx, userId, act);
      break;
    case 'move':
      handleMoveAction(state, ctx, userId, act);
      break;
    case 'kick':
      handleKickAction(state, ctx, userId, act);
      break;
    default:
      throw new GameError('BAD_ACTION', `Unknown action type: ${act.type}`);
  }
}

/** Builds client view projection masking private details and computing viewer ownership. */
function buildFoosballView(
  state: FoosballState,
  ctx: GameContext,
  userId: string,
): FoosballView {
  const side = getPlayerSide(state.seats, userId);
  const you = side ? { side, rods: getPlayerOwnedRods(state.seats, side, userId) } : null;

  const seatedIds = new Set([...state.seats.A, ...state.seats.B].map((p) => p.userId));
  const spectators = ctx.participants().filter((p) => !seatedIds.has(p.userId)).length;

  let countdown = MIN_COUNTDOWN_SECONDS;
  if (state.phase === 'countdown') {
    countdown = Math.max(MIN_COUNTDOWN_SECONDS, Math.ceil((state.countdownEndsAt - state.now()) / MS_PER_SECOND));
  }

  let graceLeft: number | null = null;
  if (state.graceExpiresAt !== null) {
    graceLeft = Math.max(MIN_GRACE_SECONDS, Math.ceil((state.graceExpiresAt - state.now()) / MS_PER_SECOND));
  }

  return {
    phase: state.phase,
    target: TARGET,
    score: { ...state.score },
    seats: {
      A: state.seats.A.map((p) => ({ ...p })),
      B: state.seats.B.map((p) => ({ ...p })),
    },
    spectators,
    you,
    ball: { ...state.world.ball },
    rods: {
      A: state.world.rods.A.map((r) => ({ y: r.y, kick: r.kick })),
      B: state.world.rods.B.map((r) => ({ y: r.y, kick: r.kick })),
    },
    countdown,
    winner: state.winner,
    forfeit: state.forfeit,
    graceLeft,
    now: state.now(),
  };
}

// ============================================================================
// Game Instance Factory
// ============================================================================

/** Creates and initializes an active Foosball game session instance. */
export function createFoosballGame(
  ctx: GameContext,
  opts?: { now?: () => number },
): GameInstance & { _world: PhysicsWorld; _score: { A: number; B: number } } {
  const state = createInitialFoosballState(opts?.now);

  return {
    get _world() {
      return state.world;
    },
    get _score() {
      return state.score;
    },
    onJoin(p: GamePlayerRef) {
      handleJoin(state, ctx, p);
    },
    onLeave(userId: string) {
      handleLeave(state, ctx, userId);
    },
    onAction(userId: string, action: unknown) {
      dispatchAction(state, ctx, userId, action);
    },
    view(userId: string): FoosballView {
      return buildFoosballView(state, ctx, userId);
    },
    dispose(): void {
      state.disposed = true;
      stopTickLoop(state);
      clearPhaseTimeouts(state);
      if (state.graceTimeout) {
        clearTimeout(state.graceTimeout);
        state.graceTimeout = undefined;
      }
    },
  };
}
