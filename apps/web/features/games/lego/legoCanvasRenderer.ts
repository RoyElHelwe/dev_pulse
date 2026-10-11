/**
 * HTML5 Canvas renderer for the interactive Lego wall board.
 * Draws baseplate studs, existing placed bricks, bevel effects, and interactive hover ghosts.
 */

import { brickAt, LEGO_PALETTE, type LegoBrick, validatePlacement } from '@/game/render/legoArt';
import { hexToRgba } from './legoBoardGeometry';
import {
  BASEPLATE_STUD_RADIUS_RATIO,
  BASEPLATE_STUD_SHADOW_OFFSET_RATIO,
  BASEPLATE_STUD_SHADOW_RADIUS_RATIO,
  BOARD_HEIGHT_STUDS, BOARD_WIDTH_STUDS,
  BRICK_STUD_HIGHLIGHT_OFFSET_RATIO, BRICK_STUD_HIGHLIGHT_RADIUS_RATIO,
  BRICK_STUD_MIN_STROKE_WIDTH_PX, BRICK_STUD_RADIUS_RATIO,
  BRICK_STUD_SHADOW_OFFSET_RATIO, BRICK_STUD_SHADOW_RADIUS_RATIO,
  BRICK_STUD_STROKE_WIDTH_RATIO,
  ERASE_CELL_LINE_WIDTH_PX, ERASE_TARGET_LINE_WIDTH_PX,
  GHOST_INVALID_FILL_ALPHA, GHOST_INVALID_LINE_WIDTH_PX,
  GHOST_INVALID_STUD_RADIUS_RATIO,
  GHOST_VALID_FILL_ALPHA, GHOST_VALID_LINE_WIDTH_PX,
  GHOST_VALID_STUD_RADIUS_RATIO,
} from './legoConstants';

/** Parameters required to render a complete Lego canvas frame. */
export interface RenderLegoCanvasOptions {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  dpr: number;
  cellSize: number;
  bricks: LegoBrick[];
  hoverPos: [number, number] | null;
  effectiveShape: [number, number];
  colorIndex: number;
  isErasing: boolean;
}

/** Draws the green baseplate surface and its stud grid. */
function drawBaseplate(
  ctx: CanvasRenderingContext2D,
  renderW: number,
  renderH: number,
  studSize: number,
): void {
  ctx.fillStyle = '#15803d';
  ctx.fillRect(0, 0, renderW, renderH);

  for (let x = 0; x < BOARD_WIDTH_STUDS; x++) {
    for (let y = 0; y < BOARD_HEIGHT_STUDS; y++) {
      const cx = (x + 0.5) * studSize;
      const cy = (y + 0.5) * studSize;

      ctx.fillStyle = '#14532d';
      ctx.beginPath();
      ctx.arc(cx, cy + studSize * BASEPLATE_STUD_SHADOW_OFFSET_RATIO, studSize * BASEPLATE_STUD_SHADOW_RADIUS_RATIO, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(cx, cy, studSize * BASEPLATE_STUD_RADIUS_RATIO, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Draws placed bricks, edge bevel highlights/shadows, and brick studs. */
function drawBricks(
  ctx: CanvasRenderingContext2D,
  bricks: LegoBrick[],
  studSize: number,
): void {
  for (const [bxStud, byStud, bwStud, bhStud, c] of bricks) {
    const colorHex = LEGO_PALETTE[c] ?? LEGO_PALETTE[0];
    const px = bxStud * studSize;
    const py = byStud * studSize;
    const pw = bwStud * studSize;
    const ph = bhStud * studSize;

    ctx.fillStyle = colorHex;
    ctx.fillRect(px, py, pw, ph);

    // Bevel highlights on top/left and shadows on bottom/right
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(px, py, pw, 1);
    ctx.fillRect(px, py, 1, ph);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(px, py + ph - 1, pw, 1);
    ctx.fillRect(px + pw - 1, py, 1, ph);

    for (let sx = 0; sx < bwStud; sx++) {
      for (let sy = 0; sy < bhStud; sy++) {
        const cx = (bxStud + sx + 0.5) * studSize;
        const cy = (byStud + sy + 0.5) * studSize;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(cx, cy + studSize * BRICK_STUD_SHADOW_OFFSET_RATIO, studSize * BRICK_STUD_SHADOW_RADIUS_RATIO, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = colorHex;
        ctx.beginPath();
        ctx.arc(cx, cy, studSize * BRICK_STUD_RADIUS_RATIO, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = Math.max(BRICK_STUD_MIN_STROKE_WIDTH_PX, studSize * BRICK_STUD_STROKE_WIDTH_RATIO);
        ctx.beginPath();
        ctx.arc(cx, cy, studSize * BRICK_STUD_RADIUS_RATIO, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(
          cx - studSize * BRICK_STUD_HIGHLIGHT_OFFSET_RATIO,
          cy - studSize * BRICK_STUD_HIGHLIGHT_OFFSET_RATIO,
          studSize * BRICK_STUD_HIGHLIGHT_RADIUS_RATIO,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
}

/** Draws the hover overlay when erase mode is active. */
function drawEraseGhost(
  ctx: CanvasRenderingContext2D,
  bricks: LegoBrick[],
  hoverPos: [number, number],
  studSize: number,
): void {
  const [hx, hy] = hoverPos;
  const target = brickAt(bricks, hx, hy);
  if (target) {
    const [tx, ty, tw, th] = target;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.fillRect(tx * studSize, ty * studSize, tw * studSize, th * studSize);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = ERASE_TARGET_LINE_WIDTH_PX;
    ctx.strokeRect(tx * studSize, ty * studSize, tw * studSize, th * studSize);
  } else {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.fillRect(hx * studSize, hy * studSize, studSize, studSize);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = ERASE_CELL_LINE_WIDTH_PX;
    ctx.strokeRect(hx * studSize, hy * studSize, studSize, studSize);
  }
}

/** Draws the hover preview brick when place mode is active. */
function drawPlacementGhost(
  ctx: CanvasRenderingContext2D,
  bricks: LegoBrick[],
  hoverPos: [number, number],
  effectiveShape: [number, number],
  colorIndex: number,
  studSize: number,
): void {
  const [hx, hy] = hoverPos;
  const [w, h] = effectiveShape;
  const ghostBrick: LegoBrick = [hx, hy, w, h, colorIndex];
  const isValid = validatePlacement(bricks, ghostBrick) === null;

  const gx = hx * studSize;
  const gy = hy * studSize;
  const gw = w * studSize;
  const gh = h * studSize;

  if (isValid) {
    const colorHex = LEGO_PALETTE[colorIndex] ?? LEGO_PALETTE[0];
    ctx.fillStyle = hexToRgba(colorHex, GHOST_VALID_FILL_ALPHA);
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = GHOST_VALID_LINE_WIDTH_PX;
    ctx.strokeRect(gx, gy, gw, gh);

    for (let sx = 0; sx < w; sx++) {
      for (let sy = 0; sy < h; sy++) {
        const cx = (hx + sx + 0.5) * studSize;
        const cy = (hy + sy + 0.5) * studSize;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(cx, cy, studSize * GHOST_VALID_STUD_RADIUS_RATIO, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    ctx.fillStyle = `rgba(239, 68, 68, ${GHOST_INVALID_FILL_ALPHA})`;
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = GHOST_INVALID_LINE_WIDTH_PX;
    ctx.strokeRect(gx, gy, gw, gh);

    for (let sx = 0; sx < w; sx++) {
      for (let sy = 0; sy < h; sy++) {
        const cx = (hx + sx + 0.5) * studSize;
        const cy = (hy + sy + 0.5) * studSize;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.beginPath();
        ctx.arc(cx, cy, studSize * GHOST_INVALID_STUD_RADIUS_RATIO, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * Renders the complete Lego board state onto the HTML5 Canvas context.
 */
export function renderLegoCanvas({
  ctx,
  canvas,
  dpr,
  cellSize,
  bricks,
  hoverPos,
  effectiveShape,
  colorIndex,
  isErasing,
}: RenderLegoCanvasOptions): void {
  const studSize = cellSize;
  const renderW = BOARD_WIDTH_STUDS * studSize;
  const renderH = BOARD_HEIGHT_STUDS * studSize;

  if (canvas.width !== Math.round(renderW * dpr) || canvas.height !== Math.round(renderH * dpr)) {
    canvas.width = Math.round(renderW * dpr);
    canvas.height = Math.round(renderH * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  drawBaseplate(ctx, renderW, renderH, studSize);
  drawBricks(ctx, bricks, studSize);

  if (hoverPos) {
    if (isErasing) {
      drawEraseGhost(ctx, bricks, hoverPos, studSize);
    } else {
      drawPlacementGhost(ctx, bricks, hoverPos, effectiveShape, colorIndex, studSize);
    }
  }

  ctx.restore();
}
