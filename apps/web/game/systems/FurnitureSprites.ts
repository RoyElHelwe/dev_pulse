/**
 * Furniture sprite rendering and visual update management for the office.
 * Manages placed furniture sprites, shadows, wall-mounted fading, and dynamic desk/board redecorations.
 */

import * as Phaser from 'phaser';
import { TILE } from '../constants';
import { itemBounds } from '../layout/geometry';
import { faceBase, isWallMounted, mountWall } from '../layout/mount';
import type { Furniture, OfficeLayout } from '../layout/types';
import type { DeskOwner } from '../objects/DeskPlates';
import { FURNITURE } from '../render/furniture';
import {
  ensureFurnitureTexture,
  ensureShadowTexture,
  furnitureCenter,
  setDeskOwners,
  setDeskPapers,
  textureScale,
  wallArtSize,
} from '../render/sprites';
import type { WallFaces } from '../render/wallFaces';
import { DEPTH, furnitureDepth } from './Depth';
import { pixels } from './RoomLocks';

/** Pixel offsets for solid furniture drop shadow sprites. */
const SHADOW_OFFSET_X_PX = 1;
const SHADOW_OFFSET_Y_PX = 4;

/** Active sprite and drop-shadow references for a placed furniture item. */
interface FurnitureSprite {
  image: Phaser.GameObjects.Image;
  shadow?: Phaser.GameObjects.Image;
  key: string;
}

/** Wall-mounted item tracking for alpha fading when players walk behind it. */
interface WallMountedSprite {
  image: Phaser.GameObjects.Image;
  xa: number;
  xb: number;
  basePx: number;
}

/** Dependencies required by the FurnitureSprites system. */
interface FurnitureSpritesOptions {
  scene: Phaser.Scene;
  getLayout: () => OfficeLayout;
  getDpr: () => number;
  isEditing?: () => boolean;
}

/** Maps desk assignments to owner character identifier. */
function ownersOf(desks: DeskOwner[]): Map<string, string> {
  return new Map(desks.filter((d) => d.character).map((d) => [d.deskId, d.character!]));
}

/** Maps desk assignments to the owner's open task count for paper stacks. */
function papersOf(desks: DeskOwner[], counts: ReadonlyMap<string, number>): Map<string, number> {
  return new Map(desks.map((d) => [d.deskId, counts.get(d.userId) ?? 0]));
}

/** Manages visual sprite creation, drop shadows, and reactive visual updates for furniture. */
export class FurnitureSprites {
  private readonly scene: Phaser.Scene;
  private readonly getLayout: () => OfficeLayout;
  private readonly getDpr: () => number;
  private readonly isEditing: () => boolean;

  /** Placed furniture sprites keyed by item id (shared with EditMode). */
  readonly sprites = new Map<string, FurnitureSprite>();

  /** Wall-mounted furniture items requiring per-frame transparency adjustments. */
  readonly wallMounted: WallMountedSprite[] = [];

  constructor(options: FurnitureSpritesOptions) {
    this.scene = options.scene;
    this.getLayout = options.getLayout;
    this.getDpr = options.getDpr;
    this.isEditing = options.isEditing ?? (() => false);
  }

  /** Places furniture and optional shadow sprites into the scene, tracking wall-mounted art. */
  addFurniture(item: Furniture, scale: number): FurnitureSprite {
    const isWall = isWallMounted(item.kind);
    const b = pixels(itemBounds(item));
    const shadow = FURNITURE[item.kind].solid && !isWall
      ? this.scene.add
          .image(b.x + SHADOW_OFFSET_X_PX, b.y + SHADOW_OFFSET_Y_PX, ensureShadowTexture(this.scene, item, scale))
          .setOrigin(0)
          .setScale(1 / scale)
          .setDepth(DEPTH.shadow)
      : undefined;
    const key = ensureFurnitureTexture(this.scene, item, scale);
    const pos = furnitureCenter(item);
    const image = this.scene.add
      .image(pos.x, pos.y, key)
      .setScale(1 / scale)
      .setRotation(isWall ? 0 : Phaser.Math.DegToRad(item.rotation ?? 0))
      .setDepth(furnitureDepth(item, this.getLayout().walls))
      .setData('furnitureId', item.id);
    const entry: FurnitureSprite = { image, shadow, key };
    this.sprites.set(item.id, entry);
    if (isWall) {
      const art = wallArtSize(item);
      const wall = mountWall(item, this.getLayout().walls);
      const base = wall ? faceBase(wall) : null;
      const basePx = (base ?? (item.y - item.h / 2)) * TILE;
      const xa = item.x * TILE - art.w / 2;
      const xb = item.x * TILE + art.w / 2;
      this.wallMounted.push({ image, xa, xb, basePx });
    }
    return entry;
  }

  /** Updates transparency of wall-mounted items based on wall occlusion. */
  updateWallAlpha(wallFaces: WallFaces): void {
    for (const m of this.wallMounted) {
      m.image.setAlpha(wallFaces.alphaFor(m.xa, m.xb, m.basePx));
    }
  }

  /** Desks show their owner's things (mug in their colour, their kind of clutter...). */
  redecorateDesks(desks: DeskOwner[], taskCounts: ReadonlyMap<string, number>): void {
    setDeskOwners(this.scene, ownersOf(desks));
    setDeskPapers(this.scene, papersOf(desks, taskCounts));
    const scale = textureScale(this.getDpr());
    const layout = this.getLayout();
    const items = this.isEditing() ? [] : layout.furniture.filter((f) => f.kind === 'desk');
    for (const item of items) {
      const sprite = this.sprites.get(item.id);
      if (!sprite) continue;
      const key = ensureFurnitureTexture(this.scene, item, scale);
      if (key === sprite.key) continue;
      const old = sprite.key;
      sprite.image.setTexture(key);
      sprite.key = key;
      // Desk textures are per desk and owner: nobody else uses the old one.
      if (this.scene.textures.exists(old)) this.scene.textures.remove(old);
    }
  }

  /** Lego wall boards redraw when art is placed/erased. */
  updateLegoBoard(objectId?: string): void {
    const scale = textureScale(this.getDpr());
    const layout = this.getLayout();
    const items = this.isEditing() ? [] : layout.furniture.filter((f) => f.kind === 'legoBoard' && (!objectId || f.id === objectId));
    for (const item of items) {
      const sprite = this.sprites.get(item.id);
      if (!sprite) continue;
      const key = ensureFurnitureTexture(this.scene, item, scale);
      const pos = furnitureCenter(item);
      sprite.image.setPosition(pos.x, pos.y);
      if (key === sprite.key) continue;
      const old = sprite.key;
      sprite.image.setTexture(key);
      sprite.key = key;
      if (old.includes(':lego') && this.scene.textures.exists(old)) {
        this.scene.textures.remove(old);
      }
    }
  }

  /** Clears sprite and wall-mounted tracking references. */
  destroy(): void {
    this.wallMounted.length = 0;
    this.sprites.clear();
  }
}
