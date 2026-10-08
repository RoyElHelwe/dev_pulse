import { describe, expect, it } from 'vitest';
import {
  BALL_R,
  clampRodOffset,
  createInitialWorld,
  FIELD_L,
  FIELD_W,
  GOAL_Y_MAX,
  GOAL_Y_MIN,
  KICK_BALL_SPEED,
  KICK_COOLDOWN,
  KICK_MIN_STRENGTH,
  MAN_R,
  manYs,
  MAX_BALL_SPEED,
  ROD_AIM_SPEED,
  ROD_TRAVEL_LIMITS,
  ROD_X,
  step,
  triggerKick,
} from './foosball.physics';

describe('Foosball Physics', () => {
  it('ball bounces off side walls', () => {
    const world = createInitialWorld();

    // Test top wall (y = 0)
    world.ball = { x: 60, y: 3, vx: 0, vy: -20 };
    const resTop = step(world, 0.1);
    expect(world.ball.y).toBeGreaterThanOrEqual(BALL_R);
    expect(world.ball.vy).toBeGreaterThan(0); // Inverted direction
    expect(resTop.events.some((e) => e.type === 'bounce')).toBe(true);

    // Test bottom wall (y = FIELD_W)
    world.ball = { x: 60, y: FIELD_W - 3, vx: 0, vy: 20 };
    const resBottom = step(world, 0.1);
    expect(world.ball.y).toBeLessThanOrEqual(FIELD_W - BALL_R);
    expect(world.ball.vy).toBeLessThan(0); // Inverted direction
    expect(resBottom.events.some((e) => e.type === 'bounce')).toBe(true);
  });

  it('goal detected only within opening', () => {
    const world = createInitialWorld();

    // Goal opening is [20, 44]
    // 1. Goal for B: ball passes x < 0 inside opening
    world.ball = { x: 1, y: (GOAL_Y_MIN + GOAL_Y_MAX) / 2, vx: -50, vy: 0 };
    const resB = step(world, 0.1);
    expect(resB.goal).toBe('B');
    expect(resB.events.some((e) => e.type === 'goal' && e.side === 'B')).toBe(true);

    // 2. Goal for A: ball passes x > 120 inside opening
    const worldA = createInitialWorld();
    worldA.ball = { x: FIELD_L - 1, y: (GOAL_Y_MIN + GOAL_Y_MAX) / 2, vx: 50, vy: 0 };
    const resA = step(worldA, 0.1);
    expect(resA.goal).toBe('A');
    expect(resA.events.some((e) => e.type === 'goal' && e.side === 'A')).toBe(true);

    // 3. Outside opening at x = 0: bounces, NO goal
    const worldWallLeft = createInitialWorld();
    worldWallLeft.ball = { x: 2, y: GOAL_Y_MIN - 5, vx: -50, vy: 0 };
    const resWallLeft = step(worldWallLeft, 0.1);
    expect(resWallLeft.goal).toBeNull();
    expect(worldWallLeft.ball.vx).toBeGreaterThan(0); // Bounced off end wall
    expect(worldWallLeft.ball.x).toBeGreaterThanOrEqual(BALL_R);

    // 4. Outside opening at x = 120: bounces, NO goal
    const worldWallRight = createInitialWorld();
    worldWallRight.ball = { x: FIELD_L - 2, y: GOAL_Y_MAX + 5, vx: 50, vy: 0 };
    const resWallRight = step(worldWallRight, 0.1);
    expect(resWallRight.goal).toBeNull();
    expect(worldWallRight.ball.vx).toBeLessThan(0); // Bounced off end wall
    expect(worldWallRight.ball.x).toBeLessThanOrEqual(FIELD_L - BALL_R);
  });

  it('rod clamp keeps outermost men inside table and goalie near mouth', () => {
    // Rod 0 (Goalkeeper)
    expect(clampRodOffset(0, 50)).toBe(ROD_TRAVEL_LIMITS[0]);
    expect(clampRodOffset(0, -50)).toBe(-ROD_TRAVEL_LIMITS[0]);
    const goalieYs = manYs(0, clampRodOffset(0, 50));
    expect(goalieYs).toHaveLength(1);
    // Goalie within goal mouth [20, 44] +/- a bit
    expect(goalieYs[0] - MAN_R).toBeLessThan(GOAL_Y_MAX + 10);
    expect(goalieYs[0] + MAN_R).toBeGreaterThan(GOAL_Y_MIN - 10);

    // Rods 1, 2, 3: outermost men must stay inside [0, FIELD_W]
    for (let rod = 1; rod <= 3; rod++) {
      const maxOffset = clampRodOffset(rod, 100);
      const ysPos = manYs(rod, maxOffset);
      const minOffset = clampRodOffset(rod, -100);
      const ysNeg = manYs(rod, minOffset);

      // Max offset: bottom-most man stays within table
      const bottomMan = ysPos[ysPos.length - 1];
      expect(bottomMan + MAN_R).toBeLessThanOrEqual(FIELD_W + 1e-4);

      // Min offset: top-most man stays within table
      const topMan = ysNeg[0];
      expect(topMan - MAN_R).toBeGreaterThanOrEqual(-1e-4);
    }
  });

  it('kick imparts impulse toward opponent only when kicking and touching', () => {
    // Team A attacks in +x direction
    const world = createInitialWorld();
    const rodX = ROD_X.A[2]; // Midfield at x = 56
    const manY = manYs(2, 0)[2]; // Middle man at y = 32

    // 1. Kick active: impulse imparted in +x direction ~150 u/s
    world.ball = { x: rodX + 3, y: manY, vx: 0, vy: 0 };
    triggerKick(world, 'A', 2);
    expect(world.rods.A[2].kickCooldown).toBeGreaterThan(0);

    step(world, 0.05); // Step during kick
    expect(world.ball.vx).toBeGreaterThanOrEqual(100); // Strong impulse towards opponent goal
    expect(Math.hypot(world.ball.vx, world.ball.vy)).toBeCloseTo(KICK_BALL_SPEED, -1);

    // 2. Not kicking: plain bounce
    const worldPlain = createInitialWorld();
    worldPlain.ball = { x: rodX + 3, y: manY, vx: -10, vy: 0 };
    // Rod 2 is not kicking
    expect(worldPlain.rods.A[2].kick).toBe(0);

    step(worldPlain, 0.05);
    // Bounces elastically, speed is nowhere near kick impulse
    expect(worldPlain.ball.vx).toBeLessThan(50);
  });

  it('kick cooldown prevents immediate re-kick', () => {
    const world = createInitialWorld();
    // First kick succeeds
    expect(triggerKick(world, 'A', 1)).toBe(true);
    expect(world.rods.A[1].kickCooldown).toBe(KICK_COOLDOWN);

    // Immediate second kick fails
    expect(triggerKick(world, 'A', 1)).toBe(false);

    // Step physics past cooldown duration
    step(world, KICK_COOLDOWN + 0.01);
    expect(world.rods.A[1].kickCooldown).toBe(0);

    // Kick succeeds again
    expect(triggerKick(world, 'A', 1)).toBe(true);
  });

  it('ball speed cap limits max speed to MAX_BALL_SPEED', () => {
    const world = createInitialWorld();
    world.ball = { x: 60, y: 32, vx: 300, vy: 400 }; // Speed = 500 > 200
    step(world, 0.01);
    const speed = Math.hypot(world.ball.vx, world.ball.vy);
    expect(speed).toBeLessThanOrEqual(MAX_BALL_SPEED + 1e-4);
  });

  it('aim moves the rod toward target at <= ROD_AIM_SPEED, reaches target without overshooting, and clamps to travel limit', () => {
    const world = createInitialWorld();
    world.rods.A[0].y = 0;
    world.rods.A[0].target = 10;

    // dt = 0.05s -> max movement is ROD_AIM_SPEED * 0.05 = 140 * 0.05 = 7
    step(world, 0.05);
    expect(world.rods.A[0].y).toBeCloseTo(7, 2);
    expect(world.rods.A[0].vel).toBeCloseTo(ROD_AIM_SPEED, 1);

    // Another dt = 0.05s -> remaining distance to 10 is 3, max step is 7.
    // It should reach 10 exactly and not overshoot to 14.
    step(world, 0.05);
    expect(world.rods.A[0].y).toBe(10);
    // After reaching target, next step should stay at target and vel becomes 0
    step(world, 0.05);
    expect(world.rods.A[0].y).toBe(10);
    expect(world.rods.A[0].vel).toBe(0);

    // Target exceeding positive travel limit (limit for rod 0 is 16)
    world.rods.A[0].target = 50;
    step(world, 0.5);
    expect(world.rods.A[0].y).toBe(ROD_TRAVEL_LIMITS[0]);

    // Target exceeding negative travel limit
    world.rods.A[0].target = -50;
    step(world, 0.5);
    expect(world.rods.A[0].y).toBe(-ROD_TRAVEL_LIMITS[0]);
  });

  it('kick strength: weak kick gives lower ball speed than full kick and strength is clamped', () => {
    const rodX = ROD_X.A[2];
    const manY = manYs(2, 0)[2];

    // 1. Full kick (strength = 1)
    const worldFull = createInitialWorld();
    worldFull.ball = { x: rodX + 3, y: manY, vx: 0, vy: 0 };
    expect(triggerKick(worldFull, 'A', 2, 1)).toBe(true);
    expect(worldFull.rods.A[2].kickPower).toBe(1);
    step(worldFull, 0.05);
    const speedFull = Math.hypot(worldFull.ball.vx, worldFull.ball.vy);

    // 2. Weak kick (strength = KICK_MIN_STRENGTH = 0.25)
    const worldWeak = createInitialWorld();
    worldWeak.ball = { x: rodX + 3, y: manY, vx: 0, vy: 0 };
    expect(triggerKick(worldWeak, 'A', 2, KICK_MIN_STRENGTH)).toBe(true);
    expect(worldWeak.rods.A[2].kickPower).toBe(KICK_MIN_STRENGTH);
    step(worldWeak, 0.05);
    const speedWeak = Math.hypot(worldWeak.ball.vx, worldWeak.ball.vy);

    expect(speedWeak).toBeLessThan(speedFull);
    expect(speedFull).toBeCloseTo(KICK_BALL_SPEED, -1);
    expect(speedWeak).toBeCloseTo(KICK_BALL_SPEED * (0.4 + 0.6 * KICK_MIN_STRENGTH), -1);

    // 3. Clamping test: strength = 0 clamps to KICK_MIN_STRENGTH, strength = 5 clamps to 1
    const worldClamp = createInitialWorld();
    triggerKick(worldClamp, 'A', 0, 0);
    expect(worldClamp.rods.A[0].kickPower).toBe(KICK_MIN_STRENGTH);

    worldClamp.rods.A[1].kickCooldown = 0;
    triggerKick(worldClamp, 'A', 1, 5);
    expect(worldClamp.rods.A[1].kickPower).toBe(1);
  });

  it('move input with dir clears target', () => {
    const world = createInitialWorld();
    world.rods.A[1].target = 10;
    step(world, 0.01, { moves: { A: { 1: 1 } } });
    expect(world.rods.A[1].target).toBeNull();
    expect(world.rods.A[1].dir).toBe(1);
  });
});
