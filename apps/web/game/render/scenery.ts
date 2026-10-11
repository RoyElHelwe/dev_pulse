/**
 * Static scenery baking and wall faces creation for the office environment.
 * Renders immovable floors and room labels into chunked textures to keep draw calls low.
 */

import * as Phaser from 'phaser';
import {
  CHUNK_PX,
  DEPTH_SORT_DIVISOR,
  DPR_SCENERY_FACTOR,
  MAX_SCENERY_SCALE,
  MAX_TEXTURE_PIXELS,
  PAD_PX,
  TILE,
} from '../constants';
import { deriveLabels } from '../layout/derive';
import { isWallMounted } from '../layout/mount';
import type { OfficeLayout } from '../layout/types';
import { DEPTH } from '../systems/Depth';
import { drawFloor } from './floors';
import { wallArtSize } from './sprites';
import { WallFaces } from './wallFaces';

const LABEL_FONT_SIZE_PX = 13;
const LABEL_LETTER_SPACING_PX = 4;
const LABEL_DARK_ALPHA = 0.4;
const LABEL_LIGHT_ALPHA = 0.55;
const LABEL_DARK_COLOR = '#3f3f46';
const LABEL_LIGHT_COLOR = '#ffffff';

/** Creates and initializes the WallFaces renderer for static room walls. */
export function createWallFaces(
  scene: Phaser.Scene,
  layout: OfficeLayout,
  worldW: number,
  worldH: number,
  dpr: number,
  fontFamily: string,
): WallFaces {
  const scale = Math.min(MAX_SCENERY_SCALE, dpr * DPR_SCENERY_FACTOR, Math.sqrt(MAX_TEXTURE_PIXELS / (worldW * worldH)));
  return new WallFaces(scene, layout.walls, {
    scale,
    depthOf: (base) => DEPTH.sorted + base / DEPTH_SORT_DIVISOR,
    labels: deriveLabels(layout),
    avoid: layout.furniture
      .filter((f) => isWallMounted(f.kind))
      .map((f) => ({ x0: f.x - wallArtSize(f).w / TILE / 2, x1: f.x + wallArtSize(f).w / TILE / 2 })),
    fontFamily,
    resolution: dpr * 2,
  });
}

/** Bakes floors and leftover room labels into static chunked render textures to optimize draw calls. */
export function bakeStaticScenery(
  scene: Phaser.Scene,
  layout: OfficeLayout,
  leftoverLabels: ReadonlyArray<{ x: number; y: number; text: string; tone: 'light' | 'dark' }>,
  dpr: number,
  fontFamily: string,
): void {
  const worldW = layout.width * TILE;
  const worldH = layout.height * TILE;
  const scenery: Array<Phaser.GameObjects.Graphics | Phaser.GameObjects.Text> = [];

  const floor = scene.add.graphics();
  layout.rooms.forEach((room) => drawFloor(floor, room));
  scenery.push(floor);

  for (const label of leftoverLabels) {
    scenery.push(
      scene.add
        .text(label.x * TILE, label.y * TILE, label.text, {
          fontFamily,
          fontSize: `${LABEL_FONT_SIZE_PX}px`,
          fontStyle: '700',
          color: label.tone === 'dark' ? LABEL_DARK_COLOR : LABEL_LIGHT_COLOR,
        })
        .setOrigin(0.5)
        .setAlpha(label.tone === 'dark' ? LABEL_DARK_ALPHA : LABEL_LIGHT_ALPHA)
        .setLetterSpacing(LABEL_LETTER_SPACING_PX)
        .setResolution(dpr * 2),
    );
  }

  // Texture pixels per world pixel, capped so big offices stay within GPU memory.
  const scale = Math.min(MAX_SCENERY_SCALE, dpr * DPR_SCENERY_FACTOR, Math.sqrt(MAX_TEXTURE_PIXELS / (worldW * worldH)));
  for (let cy = 0; cy < worldH; cy += CHUNK_PX) {
    for (let cx = 0; cx < worldW; cx += CHUNK_PX) {
      const w = Math.min(CHUNK_PX, worldW - cx) + PAD_PX * 2;
      const h = Math.min(CHUNK_PX, worldH - cy) + PAD_PX * 2;
      const rt = scene.add
        .renderTexture(cx - PAD_PX, cy - PAD_PX, Math.ceil(w * scale), Math.ceil(h * scale))
        .setOrigin(0)
        .setScale(1 / scale)
        .setDepth(DEPTH.floor);
      for (const o of scenery) {
        const { x, y, scaleX, scaleY } = o;
        o.setPosition((x - cx + PAD_PX) * scale, (y - cy + PAD_PX) * scale).setScale(scaleX * scale, scaleY * scale);
        rt.draw(o);
        o.setPosition(x, y).setScale(scaleX, scaleY);
      }
    }
  }
  scenery.forEach((o) => o.destroy());
}
