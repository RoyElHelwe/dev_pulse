import type * as Phaser from 'phaser';
import { css, type Hex } from './color';

/**
 * The few drawing calls the art needs. Characters and desks draw with a Pen,
 * so the same code paints into Phaser (the game), a canvas (the art lab) and
 * SVG (pickers and lists in React): everyone sees the same character.
 */
export interface Pen {
  /** Filled rectangle with rounded corners (radius clamped so small shapes never break). */
  rect(x: number, y: number, w: number, h: number, r: number, color: Hex, alpha?: number): void;
  circle(x: number, y: number, radius: number, color: Hex, alpha?: number): void;
  /** Filled ellipse centred on (x, y). */
  ellipse(x: number, y: number, w: number, h: number, color: Hex, alpha?: number): void;
  /** Filled polygon: [x0, y0, x1, y1, ...]. */
  poly(points: number[], color: Hex, alpha?: number): void;
  /** Filled pie slice from angle `start` to `end` (radians, clockwise). */
  pie(x: number, y: number, radius: number, start: number, end: number, color: Hex, alpha?: number): void;
  /** Outlined circle. */
  ring(x: number, y: number, radius: number, width: number, color: Hex, alpha?: number): void;
  /** Outlined arc. */
  arc(x: number, y: number, radius: number, start: number, end: number, width: number, color: Hex, alpha?: number): void;
  line(x1: number, y1: number, x2: number, y2: number, width: number, color: Hex, alpha?: number): void;
  /** Outlined rounded rectangle. */
  frame(x: number, y: number, w: number, h: number, r: number, width: number, color: Hex, alpha?: number): void;
  /** Move the origin, then rotate and scale (scaleX = -1 mirrors); undo with pop(). */
  push(x: number, y: number, angle?: number, scaleX?: number, scaleY?: number): void;
  pop(): void;
}

const radius = (r: number, w: number, h: number) => Math.max(0, Math.min(r, w / 2, h / 2));

/** Draws into a Phaser Graphics object. */
export function phaserPen(g: Phaser.GameObjects.Graphics): Pen {
  return {
    rect(x, y, w, h, r, color, alpha = 1) {
      if (w <= 0 || h <= 0) return;
      g.fillStyle(color, alpha);
      const rr = radius(r, w, h);
      if (rr < 0.5) g.fillRect(x, y, w, h);
      else g.fillRoundedRect(x, y, w, h, rr);
    },
    circle(x, y, r, color, alpha = 1) {
      g.fillStyle(color, alpha);
      g.fillCircle(x, y, r);
    },
    ellipse(x, y, w, h, color, alpha = 1) {
      g.fillStyle(color, alpha);
      g.fillEllipse(x, y, w, h, 24);
    },
    poly(points, color, alpha = 1) {
      g.fillStyle(color, alpha);
      const vs: { x: number; y: number }[] = [];
      for (let i = 0; i < points.length; i += 2) vs.push({ x: points[i], y: points[i + 1] });
      g.fillPoints(vs, true, true);
    },
    pie(x, y, r, start, end, color, alpha = 1) {
      g.fillStyle(color, alpha);
      g.slice(x, y, r, start, end, false);
      g.fillPath();
    },
    ring(x, y, r, width, color, alpha = 1) {
      g.lineStyle(width, color, alpha);
      g.strokeCircle(x, y, r);
    },
    arc(x, y, r, start, end, width, color, alpha = 1) {
      g.lineStyle(width, color, alpha);
      g.beginPath();
      g.arc(x, y, r, start, end, false);
      g.strokePath();
    },
    line(x1, y1, x2, y2, width, color, alpha = 1) {
      g.lineStyle(width, color, alpha);
      g.lineBetween(x1, y1, x2, y2);
    },
    frame(x, y, w, h, r, width, color, alpha = 1) {
      g.lineStyle(width, color, alpha);
      const rr = radius(r, w, h);
      if (rr < 0.5) g.strokeRect(x, y, w, h);
      else g.strokeRoundedRect(x, y, w, h, rr);
    },
    push(x, y, angle = 0, scaleX = 1, scaleY = 1) {
      g.save();
      g.translateCanvas(x, y);
      if (angle) g.rotateCanvas(angle);
      if (scaleX !== 1 || scaleY !== 1) g.scaleCanvas(scaleX, scaleY);
    },
    pop() {
      g.restore();
    },
  };
}

/** Draws into a 2D canvas. */
export function canvasPen(ctx: CanvasRenderingContext2D): Pen {
  const fill = (color: Hex, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = css(color);
  };
  const stroke = (color: Hex, width: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = css(color);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
  };
  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius(r, w, h));
  };
  return {
    rect(x, y, w, h, r, color, alpha = 1) {
      if (w <= 0 || h <= 0) return;
      fill(color, alpha);
      roundRect(x, y, w, h, r);
      ctx.fill();
    },
    circle(x, y, r, color, alpha = 1) {
      fill(color, alpha);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
      ctx.fill();
    },
    ellipse(x, y, w, h, color, alpha = 1) {
      fill(color, alpha);
      ctx.beginPath();
      ctx.ellipse(x, y, Math.max(0, w / 2), Math.max(0, h / 2), 0, 0, Math.PI * 2);
      ctx.fill();
    },
    poly(points, color, alpha = 1) {
      fill(color, alpha);
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
      ctx.closePath();
      ctx.fill();
    },
    pie(x, y, r, start, end, color, alpha = 1) {
      fill(color, alpha);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r, start, end);
      ctx.closePath();
      ctx.fill();
    },
    ring(x, y, r, width, color, alpha = 1) {
      stroke(color, width, alpha);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    },
    arc(x, y, r, start, end, width, color, alpha = 1) {
      stroke(color, width, alpha);
      ctx.beginPath();
      ctx.arc(x, y, r, start, end);
      ctx.stroke();
    },
    line(x1, y1, x2, y2, width, color, alpha = 1) {
      stroke(color, width, alpha);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    },
    frame(x, y, w, h, r, width, color, alpha = 1) {
      stroke(color, width, alpha);
      roundRect(x, y, w, h, r);
      ctx.stroke();
    },
    push(x, y, angle = 0, scaleX = 1, scaleY = 1) {
      ctx.save();
      ctx.translate(x, y);
      if (angle) ctx.rotate(angle);
      if (scaleX !== 1 || scaleY !== 1) ctx.scale(scaleX, scaleY);
    },
    pop() {
      ctx.restore();
      ctx.globalAlpha = 1;
    },
  };
}

/** Collects SVG markup (for React previews): call `svgPen()`, draw, then `.markup()`. */
export function svgPen(): Pen & { markup(): string } {
  const out: string[] = [];
  const n = (v: number) => String(Math.round(v * 100) / 100);
  const paint = (color: Hex, alpha: number) => `fill="${css(color)}"${alpha < 1 ? ` fill-opacity="${n(alpha)}"` : ''}`;
  const ink = (color: Hex, width: number, alpha: number) =>
    `fill="none" stroke="${css(color)}" stroke-width="${n(width)}" stroke-linecap="round"${alpha < 1 ? ` stroke-opacity="${n(alpha)}"` : ''}`;
  const arcPath = (x: number, y: number, r: number, start: number, end: number) => {
    const sweep = end - start;
    const large = sweep % (Math.PI * 2) > Math.PI ? 1 : 0;
    return `M${n(x + Math.cos(start) * r)} ${n(y + Math.sin(start) * r)}A${n(r)} ${n(r)} 0 ${large} 1 ${n(x + Math.cos(end) * r)} ${n(y + Math.sin(end) * r)}`;
  };
  return {
    rect(x, y, w, h, r, color, alpha = 1) {
      if (w <= 0 || h <= 0) return;
      const rr = radius(r, w, h);
      out.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rr ? ` rx="${n(rr)}"` : ''} ${paint(color, alpha)}/>`);
    },
    circle(x, y, r, color, alpha = 1) {
      out.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(Math.max(0, r))}" ${paint(color, alpha)}/>`);
    },
    ellipse(x, y, w, h, color, alpha = 1) {
      out.push(`<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(w / 2)}" ry="${n(h / 2)}" ${paint(color, alpha)}/>`);
    },
    poly(points, color, alpha = 1) {
      out.push(`<polygon points="${points.map(n).join(' ')}" ${paint(color, alpha)}/>`);
    },
    pie(x, y, r, start, end, color, alpha = 1) {
      out.push(`<path d="M${n(x)} ${n(y)}${arcPath(x, y, r, start, end).replace('M', 'L')}Z" ${paint(color, alpha)}/>`);
    },
    ring(x, y, r, width, color, alpha = 1) {
      out.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" ${ink(color, width, alpha)}/>`);
    },
    arc(x, y, r, start, end, width, color, alpha = 1) {
      out.push(`<path d="${arcPath(x, y, r, start, end)}" ${ink(color, width, alpha)}/>`);
    },
    line(x1, y1, x2, y2, width, color, alpha = 1) {
      out.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${ink(color, width, alpha)}/>`);
    },
    frame(x, y, w, h, r, width, color, alpha = 1) {
      const rr = radius(r, w, h);
      out.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rr ? ` rx="${n(rr)}"` : ''} ${ink(color, width, alpha)}/>`);
    },
    push(x, y, angle = 0, scaleX = 1, scaleY = 1) {
      const scale = scaleX !== 1 || scaleY !== 1 ? ` scale(${n(scaleX)} ${n(scaleY)})` : '';
      out.push(`<g transform="translate(${n(x)} ${n(y)})${angle ? ` rotate(${n((angle * 180) / Math.PI)})` : ''}${scale}">`);
    },
    pop() {
      out.push('</g>');
    },
    markup() {
      return out.join('');
    },
  };
}
