/**
 * Ref-counted cached shape texture manager.
 *
 * Why this exists (perf report 18b part 2):
 * Phaser replays and re-triangulates Graphics objects on every frame, which caused heavy CPU
 * overhead when multiple avatars or UI bubbles were active. Instead of persistent Graphics
 * objects, shapes (avatar shadows, name badges, speech and status bubbles) are drawn once into
 * dynamic textures and displayed as lightweight Phaser Images. Each texture key is reference-counted
 * across users and evicted when the last user releases it, keeping texture counts flat and
 * eliminating per-frame re-tessellation without memory leaks.
 */
import * as Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;

/** The box (in local, world-pixel units, relative to the object's origin) a baked shape is drawn in. */
export interface ShapeBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Minimum resolution scale factor for baked textures. */
const MIN_SHAPE_SCALE = 1;

/** Maximum resolution scale factor to cap texture memory while keeping high DPI sharpness. */
const MAX_SHAPE_SCALE = 3;

/**
 * Phaser replays (and re-triangulates) a Graphics object's shapes on every frame, so a persistent
 * Graphics (name tag, bubble, shadow) costs CPU forever. A baked shape is drawn once into a texture
 * shared by everything with the same key, then shown as a plain Image. Reference counted: the texture
 * is removed when the last user releases it, so nothing leaks.
 */
const uses = new Map<string, number>();

/** Texture pixels per world pixel for baked shapes (same sharpness as the Text objects). */
export const shapeScale = (resolution: number) => Math.min(MAX_SHAPE_SCALE, Math.max(MIN_SHAPE_SCALE, resolution));

/** Bakes the shape (or reuses it) and counts one more user. Returns the texture key; pair with `releaseShape`. */
export function acquireShape(scene: Phaser.Scene, key: string, bounds: ShapeBounds, scale: number, draw: (g: G) => void): string {
  const full = `shape:${key}:${scale}`;
  uses.set(full, (uses.get(full) ?? 0) + 1);
  if (!scene.textures.exists(full)) {
    const g = scene.make.graphics({}, false);
    draw(g);
    const texture = scene.textures.addDynamicTexture(full, Math.ceil(bounds.w * scale), Math.ceil(bounds.h * scale))!;
    g.setScale(scale).setPosition(-bounds.x * scale, -bounds.y * scale);
    texture.draw(g);
    g.destroy();
  }
  return full;
}

/** One user less; the texture goes with the last one. */
export function releaseShape(textures: Phaser.Textures.TextureManager, full: string) {
  const left = (uses.get(full) ?? 1) - 1;
  if (left > 0) return void uses.set(full, left);
  uses.delete(full);
  if (textures.exists(full)) textures.remove(full);
}

/** An Image showing a baked shape, placed so the shape's local coordinates match the Graphics it replaces. */
export function shapeImage(scene: Phaser.Scene, full: string, bounds: ShapeBounds, scale: number): Phaser.GameObjects.Image {
  const frame = scene.textures.getFrame(full);
  return scene.add
    .image(0, 0, full)
    .setOrigin((-bounds.x * scale) / frame.width, (-bounds.y * scale) / frame.height)
    .setScale(1 / scale);
}
