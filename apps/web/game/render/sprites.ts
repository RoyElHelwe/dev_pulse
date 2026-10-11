/**
 * Furniture texture caching, wall-mounted art sizing, and contact shadow generation.
 * Procedural furniture items are rasterized once into reusable dynamic textures.
 */
import type * as Phaser from 'phaser';
import { drawDesk } from '../art/desk';
import { phaserPen } from '../art/pen';
import { recipeOf } from '../art/recipe';
import { TILE } from '../constants';
import { itemBounds } from '../layout/geometry';
import { isWallMounted } from '../layout/mount';
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

/** Maximum texture scale clamp to avoid allocating oversized textures on high-DPI displays. */
const MAX_TEXTURE_SCALE = 3;
const DPR_SCALE_FACTOR = 1.5;

// Wall art sizing constants
const LEGO_BOARD_MAX_HEIGHT_PX = 64;
const LEGO_BOARD_ASPECT_RATIO = 1.5;
const BOARD_MAX_HEIGHT_PX = 60;
const BOARD_HEIGHT_RATIO = 0.6;
const TV_MAX_HEIGHT_PX = 60;
const TV_ASPECT_W = 16;
const TV_ASPECT_H = 9;
const WALL_MOUNT_OFFSET_Y_PX = 8;
const MAX_DESK_PAPERS = 9;

// Shadow rendering constants
const SHADOW_COLOR = 0x000000;
const SHADOW_EXTRA_WIDTH_PX = 2;
const SHADOW_ROUND_ALPHA = 0.12;
const SHADOW_ROUND_W_RATIO = 0.8;
const SHADOW_ROUND_H_RATIO = 0.75;
const SHADOW_ROUND_SEGMENTS = 24;
const SHADOW_BOX_RADIUS_PX = 8;
const SHADOW_BOX_ALPHA = 0.1;

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

function furnitureTextureKey(item: Furniture, owner?: string, papers = 0) {
  const seed = VARIES.has(item.kind) ? item.id : '';
  const legoSuffix = item.kind === 'legoBoard' && legoArt.get(item.id) !== undefined ? `:${item.id}:lego${legoArt.version(item.id)}` : '';
  return `furniture:${item.kind}:${item.w}:${item.h}:${item.color ?? ''}:${seed}:${owner ?? ''}${owner && papers ? `:p${papers}` : ''}${legoSuffix}`;
}

/** Texture pixels per world pixel: sharp at the default zoom on retina screens. */
export function textureScale(dpr: number) {
  return Math.min(MAX_TEXTURE_SCALE, dpr * DPR_SCALE_FACTOR);
}

/** Computes pixel dimensions [w, h] for wall-mounted art and screens based on tile size. */
export function wallArtSize(item: Furniture): { w: number; h: number } {
  if (item.kind === 'legoBoard') {
    const h = Math.min(LEGO_BOARD_MAX_HEIGHT_PX, (item.w * TILE * 2) / 3);
    return { w: h * LEGO_BOARD_ASPECT_RATIO, h };
  }
  if (item.kind === 'board') {
    const w = item.w * TILE;
    return { w, h: Math.min(BOARD_MAX_HEIGHT_PX, w * BOARD_HEIGHT_RATIO) };
  }
  if (item.kind === 'tv') {
    const w0 = item.w * TILE;
    const h = Math.min(TV_MAX_HEIGHT_PX, (w0 * TV_ASPECT_H) / TV_ASPECT_W);
    return { w: Math.min(w0, (h * TV_ASPECT_W) / TV_ASPECT_H), h };
  }
  return { w: item.w * TILE, h: item.h * TILE };
}

/** Computes pixel world center coordinates for placed furniture or wall art. */
export function furnitureCenter(item: Furniture): { x: number; y: number } {
  if (isWallMounted(item.kind)) {
    const art = wallArtSize(item);
    return {
      x: item.x * TILE,
      y: (item.y - item.h / 2) * TILE - WALL_MOUNT_OFFSET_Y_PX - art.h / 2,
    };
  }
  return { x: item.x * TILE, y: item.y * TILE };
}

/** Generates or reuses a cached dynamic texture for a piece of furniture. */
export function ensureFurnitureTexture(scene: Phaser.Scene, item: Furniture, scale: number) {
  const owner = deskOwner(scene, item);
  const papers = owner ? Math.min(MAX_DESK_PAPERS, deskPapers(scene, item)) : 0;
  const key = furnitureTextureKey(item, owner, papers);
  if (scene.textures.exists(key)) return key;
  const { w, h } = isWallMounted(item.kind) ? wallArtSize(item) : { w: item.w * TILE, h: item.h * TILE };
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
  const w = b.w * TILE + SHADOW_EXTRA_WIDTH_PX;
  const h = b.h * TILE;
  const g = scene.make.graphics({}, false);
  if (round) {
    g.fillStyle(SHADOW_COLOR, SHADOW_ROUND_ALPHA);
    g.fillEllipse(w / 2, h / 2, w * SHADOW_ROUND_W_RATIO, h * SHADOW_ROUND_H_RATIO, SHADOW_ROUND_SEGMENTS);
  } else {
    rr(g, 0, 0, w, h, SHADOW_BOX_RADIUS_PX, SHADOW_COLOR, SHADOW_BOX_ALPHA);
  }
  const texture = scene.textures.addDynamicTexture(key, Math.ceil(w * scale), Math.ceil(h * scale))!;
  g.setScale(scale);
  texture.draw(g);
  g.destroy();
  return key;
}
