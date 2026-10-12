/**
 * Foosball roster and seating management.
 * Pure functions governing team seats, rod ownership, and player presence.
 */

import type { GameContext } from '../game.types';
import { createInitialWorld, type PhysicsWorld } from './foosball.physics';

// ============================================================================
// Constants
// ============================================================================

/** Maximum players seated per side (2 for 2v2). */
export const MAX_PLAYERS_PER_SIDE_COUNT = 2;

/** Team size for solo play (1v1). */
const SOLO_TEAM_SIZE_COUNT = 1;

/** Defense player seat index on team roster. */
const DEFENSE_SEAT_INDEX = 0;

/** Attack player seat index on team roster. */
const ATTACK_SEAT_INDEX = 1;

/** Minimum valid rod index (0: goalkeeper). */
export const MIN_ROD_INDEX = 0;

/** Maximum valid rod index (3: attack). */
export const MAX_ROD_INDEX = 3;

/** Initial score points at match start. */
export const INITIAL_SCORE_POINTS = 0;

/** Minimum countdown delay timestamp in seconds. */
export const MIN_COUNTDOWN_SECONDS = 0;

/** Minimum grace left display in seconds. */
export const MIN_GRACE_SECONDS = 0;

/** Empty count constant for zero items. */
const EMPTY_COUNT = 0;

/** Rod indices assigned when a player controls all team rods (1v1 or solo partner). */
const ALL_ROD_INDICES = [0, 1, 2, 3] as const;

/** Rod indices assigned to the defensive seat (player index 0 in 2v2). */
const DEFENSE_ROD_INDICES = [0, 1] as const;

/** Rod indices assigned to the offensive seat (player index 1 in 2v2). */
const ATTACK_ROD_INDICES = [2, 3] as const;

// ============================================================================
// Types and Interfaces
// ============================================================================

/** Team side identifier in table soccer. */
export type FoosballSide = 'A' | 'B';

/** Match progression lifecycle phases. */
export type FoosballPhase = 'lobby' | 'countdown' | 'playing' | 'goal' | 'ended';

/** Seated foosball player metadata and presence state. */
export interface Player {
  userId: string;
  name: string;
  character: string;
  away?: boolean;
}

/** Seated player arrays indexed by team side. */
export interface FoosballSeats {
  A: Player[];
  B: Player[];
}

/** Public view state of a single rod for rendering. */
export interface RodView {
  y: number;
  kick: number;
}

/** Complete snapshot of the foosball room state sent to clients. */
export interface FoosballView {
  phase: FoosballPhase;
  target: 5;
  score: { A: number; B: number };
  seats: { A: Player[]; B: Player[] };
  spectators: number;
  you: { side: FoosballSide; rods: number[] } | null;
  ball: { x: number; y: number; vx: number; vy: number };
  rods: { A: RodView[]; B: RodView[] };
  countdown: number;
  winner: FoosballSide | null;
  forfeit: boolean;
  graceLeft: number | null;
  now: number;
}

/** Mutable internal session state shared across actions and match wiring. */
export interface FoosballState {
  phase: FoosballPhase;
  score: { A: number; B: number };
  seats: FoosballSeats;
  winner: FoosballSide | null;
  forfeit: boolean;
  recordCalled: boolean;
  disposed: boolean;
  world: PhysicsWorld;
  tickInterval?: NodeJS.Timeout;
  countdownTimeout?: NodeJS.Timeout;
  goalTimeout?: NodeJS.Timeout;
  countdownEndsAt: number;
  goalEndsAt: number;
  graceTimeout?: NodeJS.Timeout;
  graceExpiresAt: number | null;
  graceSide: FoosballSide | null;
  now: () => number;
}

// ============================================================================
// State and Seat Factories
// ============================================================================

/** Creates empty roster seats for teams A and B. */
function createInitialSeats(): FoosballSeats {
  return { A: [], B: [] };
}

/** Creates an initial mutable foosball game state in lobby phase. */
export function createInitialFoosballState(now: () => number = () => Date.now()): FoosballState {
  return {
    phase: 'lobby',
    score: { A: INITIAL_SCORE_POINTS, B: INITIAL_SCORE_POINTS },
    seats: createInitialSeats(),
    winner: null,
    forfeit: false,
    recordCalled: false,
    disposed: false,
    world: createInitialWorld(),
    countdownEndsAt: 0,
    goalEndsAt: 0,
    graceExpiresAt: null,
    graceSide: null,
    now,
  };
}

// ============================================================================
// Pure Seating and Roster Helpers
// ============================================================================

/** Returns the team side ('A' | 'B') where the given user is currently seated. */
export function getPlayerSide(seats: FoosballSeats, userId: string): FoosballSide | null {
  if (seats.A.some((p) => p.userId === userId)) return 'A';
  if (seats.B.some((p) => p.userId === userId)) return 'B';
  return null;
}

/** Computes which rods (0-3) the player controls based on seat and partner presence. */
export function getPlayerOwnedRods(seats: FoosballSeats, side: FoosballSide, userId: string): number[] {
  const team = seats[side];
  const idx = team.findIndex((p) => p.userId === userId);
  if (idx === -1) return [];

  const presentPlayers = team.filter((p) => !p.away);

  // In 1v1, or if partner is away during match, the present player controls all rods
  if (team.length <= SOLO_TEAM_SIZE_COUNT || presentPlayers.length === SOLO_TEAM_SIZE_COUNT) {
    if (!team[idx].away) {
      return [...ALL_ROD_INDICES];
    }
  }

  if (idx === DEFENSE_SEAT_INDEX) return [...DEFENSE_ROD_INDICES];
  if (idx === ATTACK_SEAT_INDEX) return [...ATTACK_ROD_INDICES];
  return [];
}

/** Validates whether both sides have equal, non-zero player counts (1v1 or 2v2). */
export function hasEqualTeams(seats: FoosballSeats): boolean {
  return seats.A.length === seats.B.length && seats.A.length > EMPTY_COUNT;
}

/** Checks whether at least one active, non-away player is present on the given side. */
export function hasPresentPlayer(seats: FoosballSeats, side: FoosballSide): boolean {
  return seats[side].some((p) => !p.away);
}

/** Returns true if any seated player across either side is currently present. */
function isAnySeatedPlayerPresent(seats: FoosballSeats): boolean {
  return [...seats.A, ...seats.B].some((p) => !p.away);
}

/** Resets away flags for all seated players on both teams. */
export function resetAwayStatus(seats: FoosballSeats): void {
  for (const p of seats.A) p.away = false;
  for (const p of seats.B) p.away = false;
}

/** Adds a player to a team seat. */
export function addPlayerToSide(seats: FoosballSeats, side: FoosballSide, player: Player): void {
  seats[side].push(player);
}

/** Removes a player from the specified team seat. */
export function removePlayerFromSide(seats: FoosballSeats, side: FoosballSide, userId: string): boolean {
  const idx = seats[side].findIndex((p) => p.userId === userId);
  if (idx !== -1) {
    seats[side].splice(idx, 1);
    return true;
  }
  return false;
}

/** Closes the game session if all seated players and spectators have departed. */
export function checkSessionClose(seats: FoosballSeats, ctx: GameContext): void {
  if (!isAnySeatedPlayerPresent(seats)) {
    const allSeated = [...seats.A, ...seats.B];
    const participants = ctx.participants();
    const spectators = participants.filter((p) => !allSeated.some((s) => s.userId === p.userId));
    if (spectators.length === EMPTY_COUNT) {
      ctx.close();
    }
  }
}
