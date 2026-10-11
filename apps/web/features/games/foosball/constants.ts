// Mirror of apps/api/src/games/foosball/foosball.physics.ts: change both together.

/**
 * Foosball shared constants, types, and view schema validation.
 * Used across the Foosball game client feature (canvas, mouse controls, panel screens).
 */

// =============================================================================
// Field & Physics Dimensions (Units)
// Mirror of apps/api/src/games/foosball/foosball.physics.ts: keep in sync
// =============================================================================

/** Pitch length in logical units. */
export const FIELD_L = 120;

/** Pitch width in logical units. */
export const FIELD_W = 64;

/** Goal mouth width in logical units. */
const GOAL_W = 24;

/** Ball radius in logical units. */
export const BALL_R = 2;

/** Foosball figurine radius in logical units. */
export const MAN_R = 3;

/** Maximum forward reach during a kick in logical units. */
export const KICK_REACH = 5;

/** Rod X positions for Team Left (A) in logical units. */
export const ROD_X_A = [8, 24, 56, 88] as const;

/** Rod X positions for Team Right (B) in logical units. */
export const ROD_X_B = [112, 96, 64, 32] as const;

/** Number of men on each rod index (0: GK, 1: DEF, 2: MID, 3: ATT). */
const ROD_MEN_COUNTS = [1, 2, 5, 3] as const;

/**
 * Maximum travel offsets per rod index in logical units.
 * Mirror of apps/api/src/games/foosball/foosball.physics.ts: keep in sync
 */
export const ROD_TRAVEL_LIMITS: readonly number[] = [
  16,
  13,
  3.4,
  FIELD_W / 6 - MAN_R,
];

/**
 * Returns the Y coordinate in logical units of each man on a rod given the rod index and offset.
 * Mirror of apps/api/src/games/foosball/foosball.physics.ts: keep in sync
 */
export function manYs(rodIndex: number, offset = 0): number[] {
  const count = ROD_MEN_COUNTS[rodIndex];
  if (!count) return [];
  const step = FIELD_W / count;
  const ys: number[] = [];
  for (let i = 0; i < count; i++) {
    ys.push((i + 0.5) * step + offset);
  }
  return ys;
}

// =============================================================================
// Canvas & Coordinate Scaling (Pixels)
// =============================================================================

/** Canvas logical width in pixels. */
export const CANVAS_W = 560;

/** Canvas logical height in pixels. */
export const CANVAS_H = 320;

/** Pitch horizontal offset inside the canvas frame in pixels. */
export const OFFSET_X = 40;

/** Pitch vertical offset inside the canvas frame in pixels. */
export const OFFSET_Y = 32;

/** Scale factor mapping physics units to logical canvas pixels (4px / unit). */
export const SCALE = 4;

// =============================================================================
// Rod & Team Metadata
// =============================================================================

/** Descriptive names for each rod index (0 to 3). */
export const ROD_NAMES = ['Goalkeeper', 'Defense', 'Midfield', 'Attack'] as const;

/** Color palettes for Team Left (A) and Team Right (B). */
export const SIDE_COLORS = {
  A: {
    name: 'Left',
    primary: '#2563eb', // blue-600
    glow: 'rgba(37, 99, 235, 0.4)',
    accent: '#60a5fa', // blue-400
  },
  B: {
    name: 'Right',
    primary: '#dc2626', // red-600
    glow: 'rgba(220, 38, 38, 0.4)',
    accent: '#f87171', // red-400
  },
} as const;

// =============================================================================
// State Types & Action Interfaces
// =============================================================================

export type FoosballSide = 'A' | 'B';
export type FoosballPhase = 'lobby' | 'countdown' | 'playing' | 'goal' | 'ended';

export interface FoosballPlayer {
  userId: string;
  name: string;
  character: string;
  away?: boolean;
}

export interface RodView {
  y: number; // pattern offset in units
  kick: number; // 0..1
}

export interface FoosballView {
  phase: FoosballPhase;
  target: 5;
  score: { A: number; B: number };
  seats: { A: FoosballPlayer[]; B: FoosballPlayer[] };
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

export type FoosballAction =
  | { type: 'sit'; side: FoosballSide }
  | { type: 'stand' }
  | { type: 'start' }
  | { type: 'rematch' }
  | { type: 'move'; rod: number; dir: -1 | 0 | 1 }
  | { type: 'kick'; rod: number; strength?: number }
  | { type: 'aim'; rod: number; y: number };

// =============================================================================
// Defaults & Type Guards
// =============================================================================

/** Initial default view displayed before room state arrives. */
export const DEFAULT_VIEW: FoosballView = {
  phase: 'lobby',
  target: 5,
  score: { A: 0, B: 0 },
  seats: { A: [], B: [] },
  spectators: 0,
  you: null,
  ball: { x: 60, y: 32, vx: 0, vy: 0 },
  rods: {
    A: [
      { y: 0, kick: 0 },
      { y: 0, kick: 0 },
      { y: 0, kick: 0 },
      { y: 0, kick: 0 },
    ],
    B: [
      { y: 0, kick: 0 },
      { y: 0, kick: 0 },
      { y: 0, kick: 0 },
      { y: 0, kick: 0 },
    ],
  },
  countdown: 0,
  winner: null,
  forfeit: false,
  graceLeft: null,
  now: 0,
};

/** Validates whether an unknown value conforms to the FoosballView shape. */
export function isFoosballView(state: unknown): state is FoosballView {
  if (typeof state !== 'object' || state === null) return false;
  const s = state as Record<string, unknown>;
  return (
    typeof s.phase === 'string' &&
    typeof s.score === 'object' &&
    s.score !== null &&
    typeof s.seats === 'object' &&
    s.seats !== null &&
    typeof s.rods === 'object' &&
    s.rods !== null &&
    typeof s.ball === 'object' &&
    s.ball !== null
  );
}
