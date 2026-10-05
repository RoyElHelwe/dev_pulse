import type * as Phaser from 'phaser';
import { TILE } from '../constants';
import { itemBounds } from '../layout/derive';
import type { Furniture } from '../layout/types';
import { rr, seededRandom } from './draw';
import { FURNITURE } from './furniture';

// Each piece of furniture is drawn once into a small texture, then shown as
// an image: cheap to draw every frame, and easy to move in the editor.

/** Extra pixels around the item (leaves and outlines go a bit past the edges). */
const PAD = 4;

/** Kinds whose drawing has random details (monitors, leaves, books...). */
const VARIES = new Set(['desk', 'plant', 'bookshelf', 'meetingTable']);

export function furnitureTextureKey(item: Furniture) {
  const seed = VARIES.has(item.kind) ? item.id : '';
  return `furniture:${item.kind}:${item.w}:${item.h}:${item.color ?? ''}:${seed}`;
}

/** Texture pixels per world pixel: sharp at the default zoom on retina screens. */
export function textureScale(dpr: number) {
  return Math.min(3, dpr * 1.5);
}

export function ensureFurnitureTexture(scene: Phaser.Scene, item: Furniture, scale: number) {
  const key = furnitureTextureKey(item);
  if (scene.textures.exists(key)) return key;
  const w = item.w * TILE;
  const h = item.h * TILE;
  const g = scene.make.graphics({}, false);
  FURNITURE[item.kind].draw(g, w, h, seededRandom(item.id), item.color);
  const texture = scene.textures.addDynamicTexture(key, Math.ceil((w + PAD * 2) * scale), Math.ceil((h + PAD * 2) * scale))!;
  g.setScale(scale).setPosition((w / 2 + PAD) * scale, (h / 2 + PAD) * scale);
  texture.draw(g);
  g.destroy();
  return key;
}

/** Soft shadow under solid furniture, same light direction for every piece. */
export function ensureShadowTexture(scene: Phaser.Scene, item: Furniture, scale: number) {
  const b = itemBounds(item);
  const round = FURNITURE[item.kind].round;
  const key = `shadow:${round ? 'round' : 'box'}:${b.w}:${b.h}`;
  if (scene.textures.exists(key)) return key;
  const w = b.w * TILE + 2;
  const h = b.h * TILE;
  const g = scene.make.graphics({}, false);
  if (round) {
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(w / 2, h / 2, w * 0.8, h * 0.75, 24);
  } else {
    rr(g, 0, 0, w, h, 8, 0x000000, 0.1);
  }
  const texture = scene.textures.addDynamicTexture(key, Math.ceil(w * scale), Math.ceil(h * scale))!;
  g.setScale(scale);
  texture.draw(g);
  g.destroy();
  return key;
}
