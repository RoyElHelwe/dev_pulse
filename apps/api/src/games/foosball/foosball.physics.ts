/**
 * Foosball physics engine.
 * Pure deterministic 2D physics simulation handling ball motion, rod movement,
 * wall collisions, kicks, and goal detection on a 120x64 foosball table.
 */

// ============================================================================
// Field dimensions and goal geometry
// ============================================================================

/** Table field length along X axis (units). */
export const FIELD_L = 120;

/** Table field width along Y axis (units). */
export const FIELD_W = 64;

/** Goal mouth width along Y axis (units). */
const GOAL_W = 24;

/** Minimum Y coordinate of the goal mouth opening (units). */
export const GOAL_Y_MIN = (FIELD_W - GOAL_W) / 2; // 20

/** Maximum Y coordinate of the goal mouth opening (units). */
export const GOAL_Y_MAX = (FIELD_W + GOAL_W) / 2; // 44

/** Target score required to win a match (goals). */
export const TARGET = 5;

// ============================================================================
// Rod configuration and constraints
// ============================================================================

/** Rod fixed X coordinates along table length per team (units). */
export const ROD_X = {
  A: [8, 24, 56, 88],
  B: [112, 96, 64, 32],
} as const;

/** Men count per rod index (0: goalkeeper, 1: defense, 2: midfield, 3: attack). */
const MEN_COUNT = [1, 2, 5, 3] as const;

/** Collision radius of a rod man figure (units). */
export const MAN_R = 3;

/** Rod manual lateral movement speed along Y axis (units/s). */
export const ROD_SPEED = 70;

/** Maximum rod speed when following a target aim position along Y axis (units/s). */
export const ROD_AIM_SPEED = 140;

/**
 * Outermost men clamping limits from rod center along Y axis (units):
 * Rod 0 (Goalkeeper, 1 man): within goal mouth +/- margin (limit 16 => covers y in [16, 48])
 * Rod 1 (Defense, 2 men): 16 - MAN_R = 13 => y in [3, 61]
 * Rod 2 (Midfield, 5 men): 6.4 - MAN_R = 3.4 => y in [3, 61]
 * Rod 3 (Attack, 3 men): (64 / 6) - MAN_R = 7.6667 => y in [3, 61]
 */
export const ROD_TRAVEL_LIMITS: readonly number[] = [
  16,
  13,
  3.4,
  FIELD_W / 6 - MAN_R,
];

// ============================================================================
// Kick dynamics
// ============================================================================

/** Minimum kick power scalar applied when kicking (fraction 0..1). */
export const KICK_MIN_STRENGTH = 0.25;

/** Total duration of the kicker swing animation (seconds). */
const KICK_DURATION = 0.18;

/** Cooldown duration before a rod can kick again (seconds). */
export const KICK_COOLDOWN = 0.35;

/** Maximum forward reach distance along X axis during kick swing (units). */
const KICK_REACH = 5;

/** Base impulse speed imparted to the ball on kick contact (units/s). */
export const KICK_BALL_SPEED = 150;

// ============================================================================
// Ball dynamics and collisions
// ============================================================================

/** Ball collision radius (units). */
export const BALL_R = 2;

/** Absolute maximum velocity speed cap for the ball (units/s). */
export const MAX_BALL_SPEED = 200;

/** Coefficient of restitution for elastic bounces against walls and idle men. */
const WALL_RESTITUTION = 0.9;

/** Ball velocity decay friction rate per second (1/s). */
const BALL_FRICTION = 0.4;

/** Speed threshold below which a ball is considered stationary/stuck (units/s). */
const UNSTUCK_SPEED = 3;

/** Stationary duration required before triggering an unstuck impulse (seconds). */
const UNSTUCK_TIME = 6;

/** Horizontal impulse speed applied to free a stuck ball toward center (units/s). */
const UNSTUCK_IMPULSE_X = 25;

/** Vertical impulse speed applied to free a stuck ball toward center (units/s). */
const UNSTUCK_IMPULSE_Y = 15;

// ============================================================================
// Simulation timing and substeps
// ============================================================================

/** Physics tick simulation frequency (Hz). */
export const TICK_RATE = 30;

/** Substep count per tick to prevent high-speed tunneling through men and walls. */
const SUBSTEPS = 4;

// ============================================================================
// Types and Interfaces
// ============================================================================

/** State of a single rod on the table. */
export interface RodState {
  y: number; // pattern offset
  dir: -1 | 0 | 1;
  kick: number; // 0..1 swing progress
  kickTimer: number; // remaining duration in kick animation
  kickCooldown: number; // remaining cooldown duration
  target: number | null;
  kickPower: number;
  vel: number;
}

/** 2D kinematic state of the foosball. */
export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Complete state of the foosball physics simulation world. */
export interface PhysicsWorld {
  ball: BallState;
  rods: {
    A: RodState[];
    B: RodState[];
  };
  stuckTimer?: number;
}

/** External control inputs applied to rods for a simulation step. */
export interface PhysicsInputs {
  moves?: {
    A?: Partial<Record<number, -1 | 0 | 1>>;
    B?: Partial<Record<number, -1 | 0 | 1>>;
  };
  kicks?: {
    A?: number[];
    B?: number[];
  };
}

/** Discrete simulation event emitted during a physics step. */
export type PhysicsEvent =
  | { type: 'bounce' }
  | { type: 'kick'; side: 'A' | 'B'; rod: number }
  | { type: 'goal'; side: 'A' | 'B' };

/** Result returned after advancing the physics simulation by one step. */
export interface StepResult {
  goal: 'A' | 'B' | null;
  events: PhysicsEvent[];
}

// ============================================================================
// Geometry and helper functions
// ============================================================================

/**
 * Clamps a rod offset to its permissible travel range along the Y axis.
 */
export function clampRodOffset(rod: number, offset: number): number {
  const limit = ROD_TRAVEL_LIMITS[rod] ?? 0;
  return Math.max(-limit, Math.min(limit, offset));
}

/**
 * Calculates absolute Y positions for all men on a given rod index.
 */
export function manYs(rod: number, offset = 0): number[] {
  const count = MEN_COUNT[rod];
  if (!count) return [];
  const step = FIELD_W / count;
  const ys: number[] = [];
  for (let i = 0; i < count; i++) {
    ys.push((i + 0.5) * step + offset);
  }
  return ys;
}

/**
 * Initializes a standard physics world with ball and rods centered at rest.
 */
export function createInitialWorld(): PhysicsWorld {
  const createTeamRods = () =>
    [0, 1, 2, 3].map(() => ({
      y: 0,
      dir: 0 as const,
      kick: 0,
      kickTimer: 0,
      kickCooldown: 0,
      target: null,
      kickPower: 1,
      vel: 0,
    }));

  return {
    ball: {
      x: FIELD_L / 2,
      y: FIELD_W / 2,
      vx: 0,
      vy: 0,
    },
    rods: {
      A: createTeamRods(),
      B: createTeamRods(),
    },
    stuckTimer: 0,
  };
}

/**
 * Triggers a kick swing on a rod if not currently cooling down.
 */
export function triggerKick(world: PhysicsWorld, side: 'A' | 'B', rod: number, strength = 1): boolean {
  const r = world.rods[side]?.[rod];
  if (!r) return false;
  if (r.kickCooldown > 0) return false;
  r.kickPower = Math.max(KICK_MIN_STRENGTH, Math.min(1, strength));
  r.kickTimer = KICK_DURATION;
  r.kickCooldown = KICK_COOLDOWN;
  return true;
}

// ============================================================================
// Physics step sub-phases
// ============================================================================

/**
 * Applies external directional movements and kick triggers to rod states.
 */
function applyInputs(world: PhysicsWorld, inputs: PhysicsInputs | undefined, events: PhysicsEvent[]): void {
  if (!inputs) return;

  if (inputs.moves?.A) {
    for (const [rStr, dir] of Object.entries(inputs.moves.A)) {
      const r = Number(rStr);
      if (world.rods.A[r] && dir !== undefined) {
        world.rods.A[r].dir = dir;
        world.rods.A[r].target = null;
      }
    }
  }
  if (inputs.moves?.B) {
    for (const [rStr, dir] of Object.entries(inputs.moves.B)) {
      const r = Number(rStr);
      if (world.rods.B[r] && dir !== undefined) {
        world.rods.B[r].dir = dir;
        world.rods.B[r].target = null;
      }
    }
  }
  if (inputs.kicks?.A) {
    for (const r of inputs.kicks.A) {
      if (triggerKick(world, 'A', r)) {
        events.push({ type: 'kick', side: 'A', rod: r });
      }
    }
  }
  if (inputs.kicks?.B) {
    for (const r of inputs.kicks.B) {
      if (triggerKick(world, 'B', r)) {
        events.push({ type: 'kick', side: 'B', rod: r });
      }
    }
  }
}

/**
 * Updates rod linear positions toward targets or directions, advancing kick animations and cooldowns.
 */
function advanceRods(world: PhysicsWorld, subDt: number): void {
  for (const side of ['A', 'B'] as const) {
    for (let r = 0; r < 4; r++) {
      const rod = world.rods[side][r];
      const oldY = rod.y;
      let newY = oldY;

      if (rod.target !== null) {
        const diff = rod.target - oldY;
        const maxStep = ROD_AIM_SPEED * subDt;
        if (Math.abs(diff) <= maxStep) {
          newY = rod.target;
        } else {
          newY = oldY + Math.sign(diff) * maxStep;
        }
        newY = clampRodOffset(r, newY);
      } else {
        newY = clampRodOffset(r, oldY + rod.dir * ROD_SPEED * subDt);
      }

      rod.y = newY;
      rod.vel = subDt > 0 ? (newY - oldY) / subDt : 0;

      // Sinusoidal swing progress forward and back over KICK_DURATION
      if (rod.kickTimer > 0) {
        rod.kickTimer = Math.max(0, rod.kickTimer - subDt);
        const progress = 1 - rod.kickTimer / KICK_DURATION;
        rod.kick = Math.sin(progress * Math.PI);
        if (rod.kickTimer === 0) rod.kick = 0;
      } else {
        rod.kick = 0;
      }

      // Decrement kick cooldown timer
      if (rod.kickCooldown > 0) {
        rod.kickCooldown = Math.max(0, rod.kickCooldown - subDt);
      }
    }
  }
}

/**
 * Integrates ball velocity into position and applies friction decay for one substep.
 */
function advanceBall(world: PhysicsWorld, subDt: number): void {
  world.ball.x += world.ball.vx * subDt;
  world.ball.y += world.ball.vy * subDt;

  const friction = Math.max(0, 1 - BALL_FRICTION * subDt);
  world.ball.vx *= friction;
  world.ball.vy *= friction;
}

/**
 * Checks if the ball center crossed the goal line within the goal mouth openings.
 */
function detectGoals(world: PhysicsWorld): 'A' | 'B' | null {
  // Goal for team B when ball passes left boundary x < 0 inside goal opening [20, 44]
  if (world.ball.x < 0 && world.ball.y >= GOAL_Y_MIN && world.ball.y <= GOAL_Y_MAX) {
    return 'B';
  }
  // Goal for team A when ball passes right boundary x > 120 inside goal opening [20, 44]
  if (world.ball.x > FIELD_L && world.ball.y >= GOAL_Y_MIN && world.ball.y <= GOAL_Y_MAX) {
    return 'A';
  }
  return null;
}

/**
 * Resolves ball collisions with top/bottom side walls and non-goal end walls.
 */
function collideBallWithWalls(world: PhysicsWorld, events: PhysicsEvent[]): void {
  // Top side wall (y = 0)
  if (world.ball.y - BALL_R < 0) {
    world.ball.y = BALL_R;
    world.ball.vy = Math.abs(world.ball.vy) * WALL_RESTITUTION;
    events.push({ type: 'bounce' });
  }

  // Bottom side wall (y = FIELD_W)
  if (world.ball.y + BALL_R > FIELD_W) {
    world.ball.y = FIELD_W - BALL_R;
    world.ball.vy = -Math.abs(world.ball.vy) * WALL_RESTITUTION;
    events.push({ type: 'bounce' });
  }

  // Left end wall (x = 0, outside goal mouth)
  if (world.ball.x < 0) {
    world.ball.x = BALL_R;
    world.ball.vx = Math.abs(world.ball.vx) * WALL_RESTITUTION;
    events.push({ type: 'bounce' });
  } else if (world.ball.x - BALL_R < 0 && (world.ball.y < GOAL_Y_MIN || world.ball.y > GOAL_Y_MAX)) {
    world.ball.x = BALL_R;
    world.ball.vx = Math.abs(world.ball.vx) * WALL_RESTITUTION;
    events.push({ type: 'bounce' });
  }

  // Right end wall (x = FIELD_L, outside goal mouth)
  if (world.ball.x > FIELD_L) {
    world.ball.x = FIELD_L - BALL_R;
    world.ball.vx = -Math.abs(world.ball.vx) * WALL_RESTITUTION;
    events.push({ type: 'bounce' });
  } else if (world.ball.x + BALL_R > FIELD_L && (world.ball.y < GOAL_Y_MIN || world.ball.y > GOAL_Y_MAX)) {
    world.ball.x = FIELD_L - BALL_R;
    world.ball.vx = -Math.abs(world.ball.vx) * WALL_RESTITUTION;
    events.push({ type: 'bounce' });
  }
}

/**
 * Resolves ball collisions against rod men, imparting kick velocity or elastic bounce.
 */
function collideBallWithMen(world: PhysicsWorld, events: PhysicsEvent[]): void {
  const collisionDist = BALL_R + MAN_R;

  for (const side of ['A', 'B'] as const) {
    const dirX = side === 'A' ? 1 : -1;

    for (let r = 0; r < 4; r++) {
      const rod = world.rods[side][r];
      const rodX = ROD_X[side][r];
      const manX = rodX + dirX * rod.kick * KICK_REACH;
      const ys = manYs(r, rod.y);

      for (const manY of ys) {
        const dx = world.ball.x - manX;
        const dy = world.ball.y - manY;
        const dist = Math.hypot(dx, dy);

        if (dist < collisionDist) {
          // Push ball out along collision normal
          let nx = dirX;
          let ny = 0;
          if (dist > 1e-4) {
            nx = dx / dist;
            ny = dy / dist;
          }
          world.ball.x = manX + nx * collisionDist;
          world.ball.y = manY + ny * collisionDist;

          if (rod.kick > 0) {
            // Kick impulse toward opponent with deflection angle based on contact offset
            const offsetFactor = Math.max(-1, Math.min(1, (world.ball.y - manY) / collisionDist));
            const deflectionAngle = offsetFactor * (Math.PI / 4);
            const kickSpeed = KICK_BALL_SPEED * (0.4 + 0.6 * rod.kickPower);
            world.ball.vx = dirX * kickSpeed * Math.cos(deflectionAngle);
            world.ball.vy = kickSpeed * Math.sin(deflectionAngle);
            events.push({ type: 'bounce' });
          } else {
            // Elastic bounce including rod linear velocity along Y
            const rodVy = rod.vel;
            const relVx = world.ball.vx;
            const relVy = world.ball.vy - rodVy;
            const vn = relVx * nx + relVy * ny;
            if (vn < 0) {
              const impVx = -(1 + WALL_RESTITUTION) * vn * nx;
              const impVy = -(1 + WALL_RESTITUTION) * vn * ny;
              world.ball.vx = relVx + impVx;
              world.ball.vy = relVy + impVy + rodVy;
              events.push({ type: 'bounce' });
            }
          }
        }
      }
    }
  }
}

/**
 * Caps maximum ball speed and nudges the ball toward center if stuck below threshold.
 */
function enforceBallLimits(world: PhysicsWorld, subDt: number): void {
  // Clamp speed to maximum cap
  const speed = Math.hypot(world.ball.vx, world.ball.vy);
  if (speed > MAX_BALL_SPEED) {
    world.ball.vx = (world.ball.vx / speed) * MAX_BALL_SPEED;
    world.ball.vy = (world.ball.vy / speed) * MAX_BALL_SPEED;
  }

  // Automatic nudge toward center if ball is stuck/idle for UNSTUCK_TIME seconds
  const curSpeed = Math.hypot(world.ball.vx, world.ball.vy);
  if (curSpeed < UNSTUCK_SPEED) {
    world.stuckTimer = (world.stuckTimer ?? 0) + subDt;
    if (world.stuckTimer >= UNSTUCK_TIME) {
      world.stuckTimer = 0;
      const towardCenterX = world.ball.x < FIELD_L / 2 ? 1 : -1;
      const towardCenterY = world.ball.y < FIELD_W / 2 ? 1 : -1;
      world.ball.vx = towardCenterX * UNSTUCK_IMPULSE_X;
      world.ball.vy = towardCenterY * UNSTUCK_IMPULSE_Y;
    }
  } else {
    world.stuckTimer = 0;
  }
}

// ============================================================================
// Main simulation step
// ============================================================================

/**
 * Advances the foosball physics simulation by dt seconds using fixed sub-iterations.
 */
export function step(world: PhysicsWorld, dt: number, inputs?: PhysicsInputs): StepResult {
  const events: PhysicsEvent[] = [];
  applyInputs(world, inputs, events);

  // Substepping prevents tunneling of high-speed ball through rods and walls
  const subDt = dt / SUBSTEPS;

  for (let s = 0; s < SUBSTEPS; s++) {
    advanceRods(world, subDt);
    advanceBall(world, subDt);

    const goal = detectGoals(world);
    if (goal) {
      events.push({ type: 'goal', side: goal });
      return { goal, events };
    }

    collideBallWithWalls(world, events);
    collideBallWithMen(world, events);
    enforceBallLimits(world, subDt);
  }

  return { goal: null, events };
}
