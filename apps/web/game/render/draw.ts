import type * as Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;

/** Filled rounded rectangle; the radius is clamped so small shapes never break. */
export function rr(g: G, x: number, y: number, w: number, h: number, r: number, color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  const radius = Math.min(r, w / 2, h / 2);
  if (radius < 0.5) g.fillRect(x, y, w, h);
  else g.fillRoundedRect(x, y, w, h, radius);
}

/** Outlined rounded rectangle. */
export function rrStroke(g: G, x: number, y: number, w: number, h: number, r: number, color: number, width = 1, alpha = 1) {
  g.lineStyle(width, color, alpha);
  const radius = Math.min(r, w / 2, h / 2);
  if (radius < 0.5) g.strokeRect(x, y, w, h);
  else g.strokeRoundedRect(x, y, w, h, radius);
}

export function circle(g: G, x: number, y: number, radius: number, color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillCircle(x, y, radius);
}

/** Lighten (amount > 0) or darken (amount < 0) a 0xRRGGBB colour. */
export function shade(color: number, amount: number) {
  const channel = (v: number) =>
    Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
  const r = channel((color >> 16) & 255);
  const g = channel((color >> 8) & 255);
  const b = channel(color & 255);
  return (r << 16) | (g << 8) | b;
}

/** Small deterministic random generator, so the office looks the same for everyone. */
export function seededRandom(seed: string) {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export type Random = ReturnType<typeof seededRandom>;

export function pick<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}
