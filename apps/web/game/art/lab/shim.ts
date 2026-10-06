import type * as Phaser from 'phaser';

/**
 * Just enough of Phaser's Graphics API, drawn into a 2D canvas, to run the
 * game's own scenery code (render/floors.ts, walls.ts, furniture.ts) in the
 * art lab without Phaser: the lab shows the real office, not a copy.
 */
export class CanvasGraphics {
  private fill = '#000';
  private fillAlpha = 1;
  private stroke = '#000';
  private strokeAlpha = 1;
  private width = 1;
  private path: Path2D | null = null;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  /** Typed as the Phaser object the scenery functions expect. */
  get g() {
    return this as unknown as Phaser.GameObjects.Graphics;
  }

  private static css(color: number) {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  fillStyle(color: number, alpha = 1) {
    this.fill = CanvasGraphics.css(color);
    this.fillAlpha = alpha;
    return this;
  }
  lineStyle(width: number, color: number, alpha = 1) {
    this.width = width;
    this.stroke = CanvasGraphics.css(color);
    this.strokeAlpha = alpha;
    return this;
  }
  private doFill(path: Path2D) {
    this.ctx.globalAlpha = this.fillAlpha;
    this.ctx.fillStyle = this.fill;
    this.ctx.fill(path);
    this.ctx.globalAlpha = 1;
  }
  private doStroke(path: Path2D) {
    this.ctx.globalAlpha = this.strokeAlpha;
    this.ctx.strokeStyle = this.stroke;
    this.ctx.lineWidth = this.width;
    this.ctx.stroke(path);
    this.ctx.globalAlpha = 1;
  }
  fillRect(x: number, y: number, w: number, h: number) {
    const p = new Path2D();
    p.rect(x, y, w, h);
    this.doFill(p);
    return this;
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    const p = new Path2D();
    p.rect(x, y, w, h);
    this.doStroke(p);
    return this;
  }
  fillRoundedRect(x: number, y: number, w: number, h: number, r: number) {
    const p = new Path2D();
    p.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
    this.doFill(p);
    return this;
  }
  strokeRoundedRect(x: number, y: number, w: number, h: number, r: number) {
    const p = new Path2D();
    p.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
    this.doStroke(p);
    return this;
  }
  fillCircle(x: number, y: number, r: number) {
    const p = new Path2D();
    p.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    this.doFill(p);
    return this;
  }
  fillEllipse(x: number, y: number, w: number, h: number) {
    const p = new Path2D();
    p.ellipse(x, y, Math.max(0, w / 2), Math.max(0, h / 2), 0, 0, Math.PI * 2);
    this.doFill(p);
    return this;
  }
  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) {
    const p = new Path2D();
    p.moveTo(x0, y0);
    p.lineTo(x1, y1);
    p.lineTo(x2, y2);
    p.closePath();
    this.doFill(p);
    return this;
  }
  slice(x: number, y: number, r: number, start: number, end: number, anticlockwise = false) {
    this.path = new Path2D();
    this.path.moveTo(x, y);
    this.path.arc(x, y, r, start, end, anticlockwise);
    this.path.closePath();
    return this;
  }
  fillPath() {
    if (this.path) this.doFill(this.path);
    this.path = null;
    return this;
  }
  save() {
    this.ctx.save();
    return this;
  }
  restore() {
    this.ctx.restore();
    return this;
  }
  translateCanvas(x: number, y: number) {
    this.ctx.translate(x, y);
    return this;
  }
  rotateCanvas(r: number) {
    this.ctx.rotate(r);
    return this;
  }
  scaleCanvas(x: number, y: number) {
    this.ctx.scale(x, y);
    return this;
  }
}
