import type * as Phaser from 'phaser';
import { drawDesk } from '../art/desk';
import { phaserPen } from '../art/pen';
import { recipeOf } from '../art/recipe';
import { TILE } from '../constants';
import { itemBounds } from '../layout/derive';
import type { Furniture } from '../layout/types';
import { rr, seededRandom } from './draw';
import { FURNITURE } from './furniture';
import { drawLegoWall, legoArt } from './legoArt';

// Each piece of furniture is drawn once into a small texture, then shown as
// an image: cheap to draw every frame, and easy to move in the editor.

/** Extra pixels around the item (leaves and outlines go a bit past the edges). */
const PAD = 4;

/** Kinds whose drawing has random details (monitors, leaves, books...). */
const VARIES = new Set(['desk', 'plant', 'bookshelf', 'meetingTable']);

/** A desk looks a bit lived-in: some notes and papers, not the end-of-day mess. */
const DESK_WEAR = 0.35;
const OWNERS = 'deskOwners';
const PAPERS = 'deskPapers';

/**
 * Who sits at each desk (desk id → their character): desks decorate
 * themselves for their owner (game/art/desk.ts). Kept in the game registry so
 * the office and the editor draw the same desks.
 */
export function setDeskOwners(scene: Phaser.Scene, owners: Map<string, string>) {
  scene.registry.set(OWNERS, owners);
}

/** Open tasks of each desk's owner (desk id → count): the paper stack on the desk grows with it. */
export function setDeskPapers(scene: Phaser.Scene, papers: Map<string, number>) {
  scene.registry.set(PAPERS, papers);
}

function deskOwner(scene: Phaser.Scene, item: Furniture) {
  if (item.kind !== 'desk') return undefined;
  return (scene.registry.get(OWNERS) as Map<string, string> | undefined)?.get(item.id);
}

function deskPapers(scene: Phaser.Scene, item: Furniture) {
  if (item.kind !== 'desk') return 0;
  return (scene.registry.get(PAPERS) as Map<string, number> | undefined)?.get(item.id) ?? 0;
}

export function furnitureTextureKey(item: Furniture, owner?: string, papers = 0) {
  const seed = VARIES.has(item.kind) ? item.id : '';
  const legoSuffix = item.kind === 'legoBoard' && legoArt.get(item.id) !== undefined ? `:${item.id}:lego${legoArt.version(item.id)}` : '';
  return `furniture:${item.kind}:${item.w}:${item.h}:${item.color ?? ''}:${seed}:${owner ?? ''}${owner && papers ? `:p${papers}` : ''}${legoSuffix}`;
}

/** Texture pixels per world pixel: sharp at the default zoom on retina screens. */
export function textureScale(dpr: number) {
  return Math.min(3, dpr * 1.5);
}

export function ensureFurnitureTexture(scene: Phaser.Scene, item: Furniture, scale: number) {
  const owner = deskOwner(scene, item);
  const papers = owner ? Math.min(9, deskPapers(scene, item)) : 0;
  const key = furnitureTextureKey(item, owner, papers);
  if (scene.textures.exists(key)) return key;
  const w = item.w * TILE;
  const h = item.h * TILE;
  const g = scene.make.graphics({}, false);
  const lego = item.kind === 'legoBoard' ? legoArt.get(item.id) : undefined;
  if (item.kind === 'desk') drawDesk(phaserPen(g), w, h, { seed: item.id, owner: owner ? recipeOf(owner) : null, wear: DESK_WEAR, papers });
  else if (lego !== undefined) drawLegoWall(g, w, h, lego);
  else FURNITURE[item.kind].draw(g, w, h, seededRandom(item.id), item.color);
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
