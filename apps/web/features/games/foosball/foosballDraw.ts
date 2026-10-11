/**
 * Layered canvas 2D rendering routines for the Foosball table.
 * Draws pitch background, markings, goal mouths, rods, men, ball, and locked cursor indicator.
 */

import {
  BALL_R,
  CANVAS_H,
  CANVAS_W,
  FIELD_L,
  FIELD_W,
  KICK_REACH,
  MAN_R,
  manYs,
  OFFSET_X,
  OFFSET_Y,
  ROD_X_A,
  ROD_X_B,
  SCALE,
  SIDE_COLORS,
  type FoosballSide,
  type RodView,
} from './constants';

const FRAME_CORNER_RADIUS_PX = 12;
const PITCH_BORDER_LINE_WIDTH_PX = 2;
const CENTER_CIRCLE_RADIUS_UNITS = 10;
const CENTER_SPOT_RADIUS_PX = 3;

const GOAL_DEPTH_PX = 24;
const GOAL_Y_START_UNITS = 20;
const GOAL_HEIGHT_UNITS = 24;

const ROD_ACTIVE_GLOW_LINE_WIDTH_PX = 8;
const ROD_LINE_WIDTH_PX = 3;
const ROD_OVERHANG_PX = 12;
const ROD_HANDLE_WIDTH_PX = 6;
const ROD_HANDLE_HEIGHT_PX = 12;

const MAN_SHADOW_OFFSET_PX = 1.5;
const ACTIVE_MAN_RING_WIDTH_PX = 2.5;
const ACTIVE_MAN_RING_EXTRA_RADIUS_PX = 3;
const MAN_STROKE_WIDTH_PX = 1.5;
const KICK_HIGHLIGHT_OFFSET_PX = 5;
const KICK_HIGHLIGHT_RADIUS_PX = 2;
const KICK_ACTIVE_THRESHOLD = 0.05;

const BALL_SHADOW_OFFSET_PX = 2;
const BALL_STROKE_WIDTH_PX = 1;
const BALL_PATTERN_RADIUS_PX = 2;

const LOCKED_CURSOR_RADIUS_PX = 6;
const LOCKED_CURSOR_OUTER_WIDTH_PX = 3;
const LOCKED_CURSOR_INNER_WIDTH_PX = 1.5;

interface StaticRodConfig {
  side: FoosballSide;
  idx: number;
  x: number;
}

/** Precomputed rod draw order sorted by x coordinate to guarantee correct layer overlap. */
const STATIC_RODS_ORDER: readonly StaticRodConfig[] = [
  ...ROD_X_A.map((x, idx) => ({ side: 'A' as const, idx, x })),
  ...ROD_X_B.map((x, idx) => ({ side: 'B' as const, idx, x })),
].sort((a, b) => a.x - b.x);

export interface DrawFoosballSceneParams {
  ballX: number;
  ballY: number;
  rodsA: readonly RodView[];
  rodsB: readonly RodView[];
  activeRod: number;
  youSide: FoosballSide | null;
  cursor: { x: number; y: number } | null;
  isLocked: boolean;
}

/** Clears the canvas and paints the rounded outer border and green pitch surface. */
function drawPitchFrame(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(0, 0, CANVAS_W, CANVAS_H, FRAME_CORNER_RADIUS_PX);
  } else {
    ctx.rect(0, 0, CANVAS_W, CANVAS_H);
  }
  ctx.fill();

  ctx.fillStyle = '#15803d';
  ctx.fillRect(OFFSET_X, OFFSET_Y, FIELD_L * SCALE, FIELD_W * SCALE);
}

/** Paints the boundary lines, halfway line, center circle, and center spot. */
function drawFieldMarkings(ctx: CanvasRenderingContext2D): void {
  const pw = FIELD_L * SCALE;
  const ph = FIELD_W * SCALE;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = PITCH_BORDER_LINE_WIDTH_PX;
  ctx.strokeRect(OFFSET_X, OFFSET_Y, pw, ph);

  const midX = OFFSET_X + pw / 2;
  const midY = OFFSET_Y + ph / 2;
  ctx.beginPath();
  ctx.moveTo(midX, OFFSET_Y);
  ctx.lineTo(midX, OFFSET_Y + ph);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(midX, midY, CENTER_CIRCLE_RADIUS_UNITS * SCALE, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(midX, midY, CENTER_SPOT_RADIUS_PX, 0, Math.PI * 2);
  ctx.fill();
}

/** Paints the left and right goal mouths with white borders. */
function drawGoals(ctx: CanvasRenderingContext2D): void {
  const pw = FIELD_L * SCALE;
  const goalY = OFFSET_Y + GOAL_Y_START_UNITS * SCALE;
  const goalH = GOAL_HEIGHT_UNITS * SCALE;
  ctx.fillStyle = '#09090b';
  ctx.strokeStyle = '#ffffff';
  for (const gx of [OFFSET_X - GOAL_DEPTH_PX, OFFSET_X + pw]) {
    ctx.fillRect(gx, goalY, GOAL_DEPTH_PX, goalH);
    ctx.strokeRect(gx, goalY, GOAL_DEPTH_PX, goalH);
  }
}

/** Combines frame, markings, and goal layers into the pitch background. */
function drawField(ctx: CanvasRenderingContext2D): void {
  drawPitchFrame(ctx);
  drawFieldMarkings(ctx);
  drawGoals(ctx);
}

/** Draws a single rod bar with metal texture, active glow, and team handle grip. */
function drawRodBar(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ph: number,
  isActive: boolean,
  side: FoosballSide,
): void {
  if (isActive) {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
    ctx.lineWidth = ROD_ACTIVE_GLOW_LINE_WIDTH_PX;
    ctx.beginPath();
    ctx.moveTo(rx, OFFSET_Y - 8);
    ctx.lineTo(rx, OFFSET_Y + ph + 8);
    ctx.stroke();
  }
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = ROD_LINE_WIDTH_PX;
  ctx.beginPath();
  ctx.moveTo(rx, OFFSET_Y - ROD_OVERHANG_PX);
  ctx.lineTo(rx, OFFSET_Y + ph + ROD_OVERHANG_PX);
  ctx.stroke();

  ctx.fillStyle = side === 'A' ? '#1d4ed8' : '#b91c1c';
  const handleY = side === 'A' ? OFFSET_Y + ph + ROD_OVERHANG_PX : OFFSET_Y - 24;
  ctx.fillRect(rx - ROD_HANDLE_WIDTH_PX / 2, handleY, ROD_HANDLE_WIDTH_PX, ROD_HANDLE_HEIGHT_PX);
}

/** Draws an individual foosball player figurine on a rod. */
function drawMan(
  ctx: CanvasRenderingContext2D,
  mx: number,
  cy: number,
  isActive: boolean,
  manColor: string,
  side: FoosballSide,
  kick: number,
): void {
  const radius = MAN_R * SCALE;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.arc(mx + MAN_SHADOW_OFFSET_PX, cy + MAN_SHADOW_OFFSET_PX, radius, 0, Math.PI * 2);
  ctx.fill();

  if (isActive) {
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = ACTIVE_MAN_RING_WIDTH_PX;
    ctx.beginPath();
    ctx.arc(mx, cy, radius + ACTIVE_MAN_RING_EXTRA_RADIUS_PX, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = manColor;
  ctx.beginPath();
  ctx.arc(mx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = MAN_STROKE_WIDTH_PX;
  ctx.stroke();

  if (kick > KICK_ACTIVE_THRESHOLD) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    const hx = mx + (side === 'A' ? KICK_HIGHLIGHT_OFFSET_PX : -KICK_HIGHLIGHT_OFFSET_PX);
    ctx.arc(hx, cy, KICK_HIGHLIGHT_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Draws all 8 rods and their figurines in order of left-to-right table coordinates. */
function drawRods(
  ctx: CanvasRenderingContext2D,
  rodsA: readonly RodView[],
  rodsB: readonly RodView[],
  activeRod: number,
  youSide: FoosballSide | null,
): void {
  const ph = FIELD_W * SCALE;
  for (const rod of STATIC_RODS_ORDER) {
    const rx = OFFSET_X + rod.x * SCALE;
    const isActive = youSide === rod.side && activeRod === rod.idx;
    const viewList = rod.side === 'A' ? rodsA : rodsB;
    const v = viewList[rod.idx] ?? { y: 0, kick: 0 };
    drawRodBar(ctx, rx, ph, isActive, rod.side);

    const kickReachPx = (rod.side === 'A' ? 1 : -1) * (v.kick || 0) * KICK_REACH * SCALE;
    const manColor = rod.side === 'A' ? SIDE_COLORS.A.primary : SIDE_COLORS.B.primary;
    for (const my of manYs(rod.idx, v.y)) {
      drawMan(ctx, rx + kickReachPx, OFFSET_Y + my * SCALE, isActive, manColor, rod.side, v.kick || 0);
    }
  }
}

/** Draws the ball with drop shadow, border, and central pentagon dot. */
function drawBall(ctx: CanvasRenderingContext2D, ballX: number, ballY: number): void {
  const bx = OFFSET_X + ballX * SCALE;
  const by = OFFSET_Y + ballY * SCALE;
  const radius = BALL_R * SCALE;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.arc(bx + BALL_SHADOW_OFFSET_PX, by + BALL_SHADOW_OFFSET_PX, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = BALL_STROKE_WIDTH_PX;
  ctx.beginPath();
  ctx.arc(bx, by, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(bx, by, BALL_PATTERN_RADIUS_PX, 0, Math.PI * 2);
  ctx.fill();
}

/** Draws the target ring cursor when pointer lock is engaged. */
function drawHud(
  ctx: CanvasRenderingContext2D,
  isLocked: boolean,
  cursor: { x: number; y: number } | null,
): void {
  if (!isLocked || !cursor) return;
  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, LOCKED_CURSOR_RADIUS_PX, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.lineWidth = LOCKED_CURSOR_OUTER_WIDTH_PX;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cursor.x, cursor.y, LOCKED_CURSOR_RADIUS_PX, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = LOCKED_CURSOR_INNER_WIDTH_PX;
  ctx.stroke();
}

/** Main scene entry point: renders all table layers in back-to-front order. */
export function drawFoosballScene(
  ctx: CanvasRenderingContext2D,
  data: DrawFoosballSceneParams,
): void {
  drawField(ctx);
  drawRods(ctx, data.rodsA, data.rodsB, data.activeRod, data.youSide);
  drawBall(ctx, data.ballX, data.ballY);
  drawHud(ctx, data.isLocked, data.cursor);
}
