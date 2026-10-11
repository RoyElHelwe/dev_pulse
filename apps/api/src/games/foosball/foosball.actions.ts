/**
 * Foosball client action handlers.
 * Validates and executes discrete client actions (sit, stand, start, aim, move, kick, rematch).
 */

import type { GameContext } from '../game.types';
import { GameError } from '../game.types';
import { clampRodOffset, createInitialWorld, triggerKick } from './foosball.physics';
import {
  addPlayerToSide,
  type FoosballSide,
  type FoosballState,
  getPlayerOwnedRods,
  getPlayerSide,
  hasEqualTeams,
  INITIAL_SCORE_POINTS,
  MAX_PLAYERS_PER_SIDE_COUNT,
  MAX_ROD_INDEX,
  MIN_ROD_INDEX,
  removePlayerFromSide,
  resetAwayStatus,
} from './foosball.roster';

// ============================================================================
// Constants
// ============================================================================

/** Default strength scalar when kicking without specifying strength. */
export const DEFAULT_KICK_STRENGTH_RATIO = 1;

/** Upward vertical movement direction unit vector. */
export const ROD_DIR_UP_VALUE = -1;

/** Stopped vertical movement direction unit vector. */
export const ROD_DIR_STOP_VALUE = 0;

/** Downward vertical movement direction unit vector. */
export const ROD_DIR_DOWN_VALUE = 1;

// ============================================================================
// Action Helpers
// ============================================================================

/** Validates that a requested rod index is an integer between 0 and 3. */
export function validateRodIndex(rod: unknown): number {
  if (typeof rod !== 'number' || rod < MIN_ROD_INDEX || rod > MAX_ROD_INDEX || !Number.isInteger(rod)) {
    throw new GameError('BAD_ACTION', 'Invalid rod index');
  }
  return rod;
}

// ============================================================================
// Action Handlers
// ============================================================================

/** Handles a player sitting on side A or B during lobby or ended phase. */
export function handleSitAction(
  state: FoosballState,
  ctx: GameContext,
  userId: string,
  act: Record<string, unknown>,
): void {
  if (state.phase !== 'lobby' && state.phase !== 'ended') {
    throw new GameError('BAD_PHASE', 'Can only sit in lobby or ended phase');
  }
  const side = act.side;
  if (side !== 'A' && side !== 'B') {
    throw new GameError('BAD_ACTION', 'Side must be A or B');
  }

  const currentSide = getPlayerSide(state.seats, userId);
  if (currentSide === side) {
    return;
  }

  if (state.seats[side].length >= MAX_PLAYERS_PER_SIDE_COUNT) {
    throw new GameError('SEAT_TAKEN', `Side ${side} is full`);
  }

  if (currentSide) {
    removePlayerFromSide(state.seats, currentSide, userId);
  }

  const pRef = ctx.participants().find((p) => p.userId === userId);
  addPlayerToSide(state.seats, side, {
    userId,
    name: pRef?.name ?? 'Player',
    character: pRef?.character ?? 'default',
  });
  ctx.emitState();
}

/** Handles a player leaving their seat during lobby or ended phase. */
export function handleStandAction(
  state: FoosballState,
  ctx: GameContext,
  userId: string,
): void {
  if (state.phase !== 'lobby' && state.phase !== 'ended') {
    throw new GameError('BAD_PHASE', 'Can only stand in lobby or ended phase');
  }
  const currentSide = getPlayerSide(state.seats, userId);
  if (currentSide) {
    removePlayerFromSide(state.seats, currentSide, userId);
    ctx.emitState();
  }
}

/** Validates roster balance and triggers match countdown start. */
export function handleStartAction(
  state: FoosballState,
  _ctx: GameContext,
  userId: string,
  startCountdown: () => void,
): void {
  if (state.phase !== 'lobby') {
    throw new GameError('BAD_PHASE', 'Can only start from lobby');
  }
  const side = getPlayerSide(state.seats, userId);
  if (!side) {
    throw new GameError('NOT_SEATED', 'Only seated players can start');
  }
  if (!hasEqualTeams(state.seats)) {
    throw new GameError('UNEVEN_TEAMS', 'Start requires equal counts on both sides (1v1 or 2v2)');
  }

  state.score.A = INITIAL_SCORE_POINTS;
  state.score.B = INITIAL_SCORE_POINTS;
  state.winner = null;
  state.forfeit = false;
  state.recordCalled = false;
  state.world = createInitialWorld();

  startCountdown();
}

/** Resets an ended match back to lobby phase preserving current seating. */
export function handleRematchAction(
  state: FoosballState,
  ctx: GameContext,
  userId: string,
  resetTimers: () => void,
): void {
  if (state.phase !== 'ended') {
    throw new GameError('BAD_PHASE', 'Can only rematch when ended');
  }
  const side = getPlayerSide(state.seats, userId);
  if (!side) {
    throw new GameError('NOT_SEATED', 'Only seated players can rematch');
  }

  state.phase = 'lobby';
  state.score.A = INITIAL_SCORE_POINTS;
  state.score.B = INITIAL_SCORE_POINTS;
  state.winner = null;
  state.forfeit = false;
  state.recordCalled = false;
  state.graceExpiresAt = null;
  state.graceSide = null;
  resetTimers();

  state.world = createInitialWorld();
  resetAwayStatus(state.seats);

  ctx.emitState();
}

/** Handles continuous pointer movement aiming a controlled rod along Y. */
export function handleAimAction(
  state: FoosballState,
  _ctx: GameContext,
  userId: string,
  act: Record<string, unknown>,
): void {
  const side = getPlayerSide(state.seats, userId);
  if (!side) {
    throw new GameError('NOT_SEATED', 'Only seated players can aim rods');
  }
  const rod = validateRodIndex(act.rod);
  const y = act.y;
  if (typeof y !== 'number' || !Number.isFinite(y)) {
    throw new GameError('BAD_ACTION', 'Invalid y');
  }

  const owned = getPlayerOwnedRods(state.seats, side, userId);
  if (!owned.includes(rod)) {
    throw new GameError('NOT_YOUR_ROD', 'Not your rod');
  }

  if (state.phase !== 'playing') {
    return;
  }

  state.world.rods[side][rod].target = clampRodOffset(rod, y);
  state.world.rods[side][rod].dir = ROD_DIR_STOP_VALUE;
}

/** Handles discrete keyboard movement setting directional velocity on a rod. */
export function handleMoveAction(
  state: FoosballState,
  _ctx: GameContext,
  userId: string,
  act: Record<string, unknown>,
): void {
  const side = getPlayerSide(state.seats, userId);
  if (!side) {
    throw new GameError('NOT_SEATED', 'Only seated players can move rods');
  }
  const rod = validateRodIndex(act.rod);
  const dir = act.dir;
  if (dir !== ROD_DIR_UP_VALUE && dir !== ROD_DIR_STOP_VALUE && dir !== ROD_DIR_DOWN_VALUE) {
    throw new GameError('BAD_ACTION', 'Invalid dir');
  }

  const owned = getPlayerOwnedRods(state.seats, side, userId);
  if (!owned.includes(rod)) {
    throw new GameError('NOT_YOUR_ROD', 'Not your rod');
  }

  if (state.phase !== 'playing') {
    throw new GameError('BAD_PHASE', 'Can only move rods during playing phase');
  }

  state.world.rods[side][rod].dir = dir;
  state.world.rods[side][rod].target = null;
}

/** Handles kicking a rod with optional impulse strength scalar. */
export function handleKickAction(
  state: FoosballState,
  ctx: GameContext,
  userId: string,
  act: Record<string, unknown>,
): void {
  const side = getPlayerSide(state.seats, userId);
  if (!side) {
    throw new GameError('NOT_SEATED', 'Only seated players can kick rods');
  }
  const rod = validateRodIndex(act.rod);

  const owned = getPlayerOwnedRods(state.seats, side, userId);
  if (!owned.includes(rod)) {
    throw new GameError('NOT_YOUR_ROD', 'Not your rod');
  }

  if (state.phase !== 'playing') {
    throw new GameError('BAD_PHASE', 'Can only kick during playing phase');
  }

  let strength = DEFAULT_KICK_STRENGTH_RATIO;
  if (act.strength !== undefined) {
    if (typeof act.strength !== 'number' || !Number.isFinite(act.strength)) {
      throw new GameError('BAD_ACTION', 'Invalid strength');
    }
    strength = act.strength;
  }

  if (triggerKick(state.world, side, rod, strength)) {
    ctx.emitEvent('kick', { side, rod });
  }
}
