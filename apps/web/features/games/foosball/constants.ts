export const FIELD_L = 120;
export const FIELD_W = 64;
export const GOAL_W = 24;
export const GOAL_Y_START = 20; // centered on 32, half-width 12
export const GOAL_Y_END = 44;
export const BALL_R = 2;
export const MAN_R = 3;
export const ROD_SPEED = 70;
export const KICK_REACH = 5;
export const KICK_DURATION_SEC = 0.18;
export const KICK_COOLDOWN_SEC = 0.35;
export const TARGET_SCORE = 5;
export const TICK_HZ = 30;
export const GRACE_MS = 10000;

export const CANVAS_W = 560;
export const CANVAS_H = 320;
export const OFFSET_X = 40;
export const OFFSET_Y = 32;
export const SCALE = 4;

export const ROD_TRAVEL_LIMITS: readonly number[] = [
  16,
  13,
  3.4,
  FIELD_W / 6 - MAN_R,
];

export const ROD_X_A = [8, 24, 56, 88] as const;
export const ROD_X_B = [112, 96, 64, 32] as const;
export const ROD_MEN_COUNTS = [1, 2, 5, 3] as const;
export const ROD_NAMES = ['Goalkeeper', 'Defense', 'Midfield', 'Attack'] as const;

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

/**
 * Returns the Y coordinate of each man on a rod given the rod index and offset.
 * Men are evenly spaced across the width with the rod's y offset shifting the whole pattern.
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
