/**
 * Canvas drawing primitives (rounded rects, shading) and deterministic seeded PRNG
 * utilities used by procedural floor, furniture, and wall rendering.
 */
import type * as Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;

/** Below this radius, Phaser rounded rects degrade; draw a simple rect instead. */
const MIN_CORNER_RADIUS = 0.5;

/** Filled rounded rectangle; the radius is clamped so small shapes never break. */
export function rr(g: G, x: number, y: number, w: number, h: number, r: number, color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  const radius = Math.min(r, w / 2, h / 2);
  if (radius < MIN_CORNER_RADIUS) g.fillRect(x, y, w, h);
  else g.fillRoundedRect(x, y, w, h, radius);
}

/** Outlined rounded rectangle. */
export function rrStroke(g: G, x: number, y: number, w: number, h: number, r: number, color: number, width = 1, alpha = 1) {
  g.lineStyle(width, color, alpha);
  const radius = Math.min(r, w / 2, h / 2);
  if (radius < MIN_CORNER_RADIUS) g.strokeRect(x, y, w, h);
  else g.strokeRoundedRect(x, y, w, h, radius);
}

/** Filled circle helper. */
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
  // MurmurHash3 string seeding followed by splitmix32 / Murmur3 32-bit avalanche mixing,
  // producing deterministic pseudo-random floats in [0, 1) across all clients.
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Deterministic pseudo-random number generator function returning numbers in [0, 1). */
export type Random = ReturnType<typeof seededRandom>;

/** Uniformly selects an element from a readonly array. */
export function pick<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

/** Picks a value with a probability proportional to its weight. */
export function weighted<T>(random: Random, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = random() * total;
  for (const [value, w] of entries) if ((roll -= w) < 0) return value;
  return entries[entries.length - 1][0];
}
