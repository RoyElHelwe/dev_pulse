// Pure deterministic foosball physics engine.
// Table length is along X (0..120), table width is along Y (0..64).

export const FIELD_L = 120;
export const FIELD_W = 64;
export const GOAL_W = 24;
export const GOAL_Y_MIN = (FIELD_W - GOAL_W) / 2; // 20
export const GOAL_Y_MAX = (FIELD_W + GOAL_W) / 2; // 44
export const BALL_R = 2;
export const MAN_R = 3;
export const TARGET = 5;

// Rod x coordinates
export const ROD_X = {
  A: [8, 24, 56, 88],
  B: [112, 96, 64, 32],
} as const;

// Men count per rod index (0: goalkeeper, 1: defense, 2: midfield, 3: attack)
export const MEN_COUNT = [1, 2, 5, 3] as const;

export const ROD_SPEED = 70; // units/s
export const ROD_AIM_SPEED = 140; // units/s max speed when following a target
export const KICK_MIN_STRENGTH = 0.25;
export const KICK_DURATION = 0.18; // s
export const KICK_COOLDOWN = 0.35; // s
export const KICK_REACH = 5; // max units reached forward during kick
export const KICK_BALL_SPEED = 150; // units/s imparted on kick
export const MAX_BALL_SPEED = 200; // units/s speed cap
export const WALL_RESTITUTION = 0.9;
export const BALL_FRICTION = 0.4; // decay / s
export const TICK_RATE = 30; // 30 Hz
export const SUBSTEPS = 4;
export const UNSTUCK_TIME = 6; // seconds before unstuck nudge
export const UNSTUCK_SPEED = 3; // speed threshold for stuck ball

// Outermost men clamping limits:
// Rod 0 (Goalkeeper, 1 man): within goal mouth +/- a bit (limit 16 => covers y in [16, 48])
// Rod 1 (Defense, 2 men): 16 - MAN_R = 13 => y in [3, 61]
// Rod 2 (Midfield, 5 men): 6.4 - MAN_R = 3.4 => y in [3, 61]
// Rod 3 (Attack, 3 men): (64 / 6) - MAN_R = 7.6667 => y in [3, 61]
export const ROD_TRAVEL_LIMITS: readonly number[] = [
  16,
  13,
  3.4,
  FIELD_W / 6 - MAN_R,
];

export function clampRodOffset(rod: number, offset: number): number {
  const limit = ROD_TRAVEL_LIMITS[rod] ?? 0;
  return Math.max(-limit, Math.min(limit, offset));
}
export const clampRodTravel = clampRodOffset;

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

export interface RodState {
  y: number; // pattern offset
  dir: -1 | 0 | 1;
  kick: number; // 0..1
  kickTimer: number; // remaining duration in kick animation
  kickCooldown: number; // remaining cooldown
  target: number | null;
  kickPower: number;
  vel: number;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface PhysicsWorld {
  ball: BallState;
  rods: {
    A: RodState[];
    B: RodState[];
  };
  stuckTimer?: number;
}

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

export type PhysicsEvent =
  | { type: 'bounce' }
  | { type: 'kick'; side: 'A' | 'B'; rod: number }
  | { type: 'goal'; side: 'A' | 'B' };

export interface StepResult {
  goal: 'A' | 'B' | null;
  events: PhysicsEvent[];
}

export function createInitialWorld(): PhysicsWorld {
  return {
    ball: {
      x: FIELD_L / 2,
      y: FIELD_W / 2,
      vx: 0,
      vy: 0,
    },
    rods: {
      A: [0, 1, 2, 3].map(() => ({
        y: 0,
        dir: 0,
        kick: 0,
        kickTimer: 0,
        kickCooldown: 0,
        target: null,
        kickPower: 1,
        vel: 0,
      })),
      B: [0, 1, 2, 3].map(() => ({
        y: 0,
        dir: 0,
        kick: 0,
        kickTimer: 0,
        kickCooldown: 0,
        target: null,
        kickPower: 1,
        vel: 0,
      })),
    },
    stuckTimer: 0,
  };
}

export function triggerKick(world: PhysicsWorld, side: 'A' | 'B', rod: number, strength = 1): boolean {
  const r = world.rods[side]?.[rod];
  if (!r) return false;
  if (r.kickCooldown > 0) return false;
  r.kickPower = Math.max(KICK_MIN_STRENGTH, Math.min(1, strength));
  r.kickTimer = KICK_DURATION;
  r.kickCooldown = KICK_COOLDOWN;
  return true;
}

export function step(world: PhysicsWorld, dt: number, inputs?: PhysicsInputs): StepResult {
  const events: PhysicsEvent[] = [];
  let detectedGoal: 'A' | 'B' | null = null;

  // Apply inputs if provided
  if (inputs?.moves?.A) {
    for (const [rStr, dir] of Object.entries(inputs.moves.A)) {
      const r = Number(rStr);
      if (world.rods.A[r] && dir !== undefined) {
        world.rods.A[r].dir = dir;
        world.rods.A[r].target = null;
      }
    }
  }
  if (inputs?.moves?.B) {
    for (const [rStr, dir] of Object.entries(inputs.moves.B)) {
      const r = Number(rStr);
      if (world.rods.B[r] && dir !== undefined) {
        world.rods.B[r].dir = dir;
        world.rods.B[r].target = null;
      }
    }
  }
  if (inputs?.kicks?.A) {
    for (const r of inputs.kicks.A) {
      if (triggerKick(world, 'A', r)) {
        events.push({ type: 'kick', side: 'A', rod: r });
      }
    }
  }
  if (inputs?.kicks?.B) {
    for (const r of inputs.kicks.B) {
      if (triggerKick(world, 'B', r)) {
        events.push({ type: 'kick', side: 'B', rod: r });
      }
    }
  }

  const subDt = dt / SUBSTEPS;

  for (let s = 0; s < SUBSTEPS; s++) {
    // 1. Update rods
    for (const side of ['A', 'B'] as const) {
      for (let r = 0; r < 4; r++) {
        const rod = world.rods[side][r];
        // Move rod
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

        // Update kick animation
        if (rod.kickTimer > 0) {
          rod.kickTimer = Math.max(0, rod.kickTimer - subDt);
          const progress = 1 - rod.kickTimer / KICK_DURATION;
          rod.kick = Math.sin(progress * Math.PI);
          if (rod.kickTimer === 0) rod.kick = 0;
        } else {
          rod.kick = 0;
        }

        // Update cooldown
        if (rod.kickCooldown > 0) {
          rod.kickCooldown = Math.max(0, rod.kickCooldown - subDt);
        }
      }
    }

    // 2. Move ball
    world.ball.x += world.ball.vx * subDt;
    world.ball.y += world.ball.vy * subDt;

    // 3. Ball friction decay (~0.4/s)
    const friction = Math.max(0, 1 - BALL_FRICTION * subDt);
    world.ball.vx *= friction;
    world.ball.vy *= friction;

    // 4. Wall collisions & Goals
    // Top side wall
    if (world.ball.y - BALL_R < 0) {
      world.ball.y = BALL_R;
      world.ball.vy = Math.abs(world.ball.vy) * WALL_RESTITUTION;
      events.push({ type: 'bounce' });
    }
    // Bottom side wall
    if (world.ball.y + BALL_R > FIELD_W) {
      world.ball.y = FIELD_W - BALL_R;
      world.ball.vy = -Math.abs(world.ball.vy) * WALL_RESTITUTION;
      events.push({ type: 'bounce' });
    }

    // Left end wall (x = 0)
    // Goal when ball center passes x < 0 within goal opening [20, 44]
    if (world.ball.x < 0) {
      if (world.ball.y >= GOAL_Y_MIN && world.ball.y <= GOAL_Y_MAX) {
        detectedGoal = 'B';
        events.push({ type: 'goal', side: 'B' });
        return { goal: detectedGoal, events };
      } else {
        world.ball.x = BALL_R;
        world.ball.vx = Math.abs(world.ball.vx) * WALL_RESTITUTION;
        events.push({ type: 'bounce' });
      }
    } else if (world.ball.x - BALL_R < 0 && (world.ball.y < GOAL_Y_MIN || world.ball.y > GOAL_Y_MAX)) {
      world.ball.x = BALL_R;
      world.ball.vx = Math.abs(world.ball.vx) * WALL_RESTITUTION;
      events.push({ type: 'bounce' });
    }

    // Right end wall (x = FIELD_L = 120)
    // Goal when ball center passes x > 120 within goal opening [20, 44]
    if (world.ball.x > FIELD_L) {
      if (world.ball.y >= GOAL_Y_MIN && world.ball.y <= GOAL_Y_MAX) {
        detectedGoal = 'A';
        events.push({ type: 'goal', side: 'A' });
        return { goal: detectedGoal, events };
      } else {
        world.ball.x = FIELD_L - BALL_R;
        world.ball.vx = -Math.abs(world.ball.vx) * WALL_RESTITUTION;
        events.push({ type: 'bounce' });
      }
    } else if (world.ball.x + BALL_R > FIELD_L && (world.ball.y < GOAL_Y_MIN || world.ball.y > GOAL_Y_MAX)) {
      world.ball.x = FIELD_L - BALL_R;
      world.ball.vx = -Math.abs(world.ball.vx) * WALL_RESTITUTION;
      events.push({ type: 'bounce' });
    }

    // 5. Collisions with men
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
            // Push out
            let nx = dirX;
            let ny = 0;
            if (dist > 1e-4) {
              nx = dx / dist;
              ny = dy / dist;
            }
            world.ball.x = manX + nx * collisionDist;
            world.ball.y = manY + ny * collisionDist;

            if (rod.kick > 0) {
              // Kick impulse: toward opponent + deflection from contact offset
              const offsetFactor = Math.max(-1, Math.min(1, (world.ball.y - manY) / collisionDist));
              const deflectionAngle = offsetFactor * (Math.PI / 4);
              const kickSpeed = KICK_BALL_SPEED * (0.4 + 0.6 * rod.kickPower);
              world.ball.vx = dirX * kickSpeed * Math.cos(deflectionAngle);
              world.ball.vy = kickSpeed * Math.sin(deflectionAngle);
              events.push({ type: 'bounce' });
            } else {
              // Plain bounce
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

    // 6. Speed cap
    const speed = Math.hypot(world.ball.vx, world.ball.vy);
    if (speed > MAX_BALL_SPEED) {
      world.ball.vx = (world.ball.vx / speed) * MAX_BALL_SPEED;
      world.ball.vy = (world.ball.vy / speed) * MAX_BALL_SPEED;
    }

    // 7. Unstuck logic
    const curSpeed = Math.hypot(world.ball.vx, world.ball.vy);
    if (curSpeed < UNSTUCK_SPEED) {
      world.stuckTimer = (world.stuckTimer ?? 0) + subDt;
      if (world.stuckTimer >= UNSTUCK_TIME) {
        world.stuckTimer = 0;
        const towardCenterX = world.ball.x < FIELD_L / 2 ? 1 : -1;
        world.ball.vx = towardCenterX * 25;
        world.ball.vy = (world.ball.y < FIELD_W / 2 ? 1 : -1) * 15;
      }
    } else {
      world.stuckTimer = 0;
    }
  }

  return { goal: detectedGoal, events };
}
