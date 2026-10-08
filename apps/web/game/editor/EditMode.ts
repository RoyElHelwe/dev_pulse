import * as Phaser from 'phaser';
import { TILE } from '../constants';
import { itemBounds } from '../layout/derive';
import { isWallMounted, snapToWall } from '../layout/mount';
import type { Furniture } from '../layout/types';
import { FURNITURE } from '../render/furniture';
import { ensureFurnitureTexture, ensureShadowTexture, furnitureCenter } from '../render/sprites';
import type { LayoutEditor } from './LayoutEditor';
import { PROBLEM_TEXT, type PlacementProblem } from './rules';

interface Sprite {
  image: Phaser.GameObjects.Image;
  shadow?: Phaser.GameObjects.Image;
  key: string;
}

export interface EditModeHost {
  scene: Phaser.Scene;
  textureScale: number;
  /** The furniture images the scene created, by id (edit mode takes them over). */
  sprites: Map<string, Sprite>;
  depthOf(item: Furniture): number;
  shadowDepth: number;
}

/**
 * Editing inside the real office: drag furniture, place new pieces from the
 * palette, pan the camera. All changes go through the LayoutEditor; this class
 * only turns mouse and keyboard into editor calls and draws the result.
 */
export class EditMode {
  private readonly scene: Phaser.Scene;
  private readonly outline: Phaser.GameObjects.Graphics;
  private ghost: Phaser.GameObjects.Image | null = null;
  private drag: { x: number; y: number } | null = null;
  /** Shift + drag on the floor: selection box (world pixels). */
  private box: { x: number; y: number; add: boolean } | null = null;
  private readonly boxGraphics: Phaser.GameObjects.Graphics;
  private panning = false;
  private unsubscribe: () => void;

  constructor(
    private readonly host: EditModeHost,
    private readonly editor: LayoutEditor,
    private readonly onProblem: (text: string) => void,
  ) {
    this.scene = host.scene;
    this.outline = this.scene.add.graphics().setDepth(1000);
    this.boxGraphics = this.scene.add.graphics().setDepth(1001);
    for (const sprite of host.sprites.values()) this.makeInteractive(sprite.image);

    const input = this.scene.input;
    input.on('pointerdown', this.onDown, this);
    input.on('pointermove', this.onMove, this);
    input.on('pointerup', this.onUp, this);
    input.on('pointerupoutside', this.onUp, this);
    // A plain DOM listener: exactly one call per key press, and it sees the real target.
    window.addEventListener('keydown', this.onKey);
    this.unsubscribe = editor.subscribe(() => this.sync());
    this.sync();
  }

  destroy() {
    const input = this.scene.input;
    input.off('pointerdown', this.onDown, this);
    input.off('pointermove', this.onMove, this);
    input.off('pointerup', this.onUp, this);
    input.off('pointerupoutside', this.onUp, this);
    window.removeEventListener('keydown', this.onKey);
    input.setDefaultCursor('default');
    this.unsubscribe();
    this.outline.destroy();
    this.boxGraphics.destroy();
    this.ghost?.destroy();
  }

  // ---- mouse -------------------------------------------------------------------

  private onDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    const state = this.editor.getState();
    if (state.placing) {
      const problem = this.editor.place(pointer.worldX / TILE, pointer.worldY / TILE);
      if (problem) this.problem(problem);
      return;
    }
    const shift = (pointer.event as MouseEvent | undefined)?.shiftKey ?? false;
    const id = over.map((o) => o.getData('furnitureId') as string | undefined).find(Boolean);
    if (id && shift) {
      this.editor.select(id, true);
    } else if (id) {
      // Dragging a selected piece moves the whole selection.
      if (!this.editor.isSelected(id)) this.editor.select(id);
      this.editor.beginDrag();
      this.drag = { x: pointer.worldX, y: pointer.worldY };
      this.scene.input.setDefaultCursor('grabbing');
    } else if (shift) {
      this.box = { x: pointer.worldX, y: pointer.worldY, add: true };
    } else {
      this.editor.select(null);
      this.panning = true;
      this.scene.input.setDefaultCursor('grabbing');
    }
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (this.drag) {
      this.editor.dragBy((pointer.worldX - this.drag.x) / TILE, (pointer.worldY - this.drag.y) / TILE);
    } else if (this.box) {
      const g = this.boxGraphics;
      const x = Math.min(this.box.x, pointer.worldX);
      const y = Math.min(this.box.y, pointer.worldY);
      const w = Math.abs(pointer.worldX - this.box.x);
      const h = Math.abs(pointer.worldY - this.box.y);
      g.clear();
      g.fillStyle(0x10b981, 0.08).fillRect(x, y, w, h);
      g.lineStyle(1.5, 0x10b981, 1).strokeRect(x, y, w, h);
    } else if (this.panning && pointer.isDown) {
      const cam = this.scene.cameras.main;
      cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
      cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
    } else if (this.editor.getState().placing) {
      this.updateGhost(pointer);
    }
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    if (this.drag) {
      const problem = this.editor.endDrag();
      if (problem) this.problem(problem);
    }
    if (this.box) {
      const b = this.box;
      this.editor.selectBox(b.x / TILE, b.y / TILE, pointer.worldX / TILE, pointer.worldY / TILE, b.add);
      this.boxGraphics.clear();
    }
    this.box = null;
    this.drag = null;
    this.panning = false;
    this.scene.input.setDefaultCursor('default');
  }

  // ---- keyboard -------------------------------------------------------------------

  private onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const { selectedIds, placing } = this.editor.getState();
    const selected = selectedIds.length > 0;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    let problem: PlacementProblem | null = null;

    if (mod && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.editor.redo();
      else this.editor.undo();
    } else if (mod && key === 'y') {
      event.preventDefault();
      this.editor.redo();
    } else if (key === 'escape') {
      if (placing) this.editor.cancelPlacing();
      else this.editor.select(null);
    } else if (mod && key === 'a') {
      event.preventDefault();
      const { width, height } = this.editor.layout;
      this.editor.selectBox(0, 0, width, height);
    } else if (selected && mod && key === 'd') {
      event.preventDefault();
      problem = this.editor.duplicate();
    } else if (selected && (key === 'delete' || key === 'backspace')) {
      event.preventDefault();
      this.editor.remove();
    } else if (selected && key === 'r' && !mod) {
      problem = this.editor.rotate(!event.shiftKey);
    } else if (key.startsWith('arrow')) {
      event.preventDefault();
      const step = event.shiftKey ? 1 : 0.25;
      const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
      const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
      if (selected) {
        problem = this.editor.nudge(dx, dy);
      } else {
        const cam = this.scene.cameras.main;
        cam.scrollX += dx * TILE * 4;
        cam.scrollY += dy * TILE * 4;
      }
    }
    if (problem) this.problem(problem);
  };

  // ---- drawing ------------------------------------------------------------------------

  /** Brings the furniture images in line with the editor's state. */
  private sync() {
    const state = this.editor.getState();
    const { sprites, scene, textureScale } = this.host;
    const seen = new Set<string>();

    for (const item of state.furniture) {
      seen.add(item.id);
      let sprite = sprites.get(item.id);
      const key = ensureFurnitureTexture(scene, item, textureScale);
      if (!sprite) {
        const image = scene.add.image(0, 0, key).setScale(1 / textureScale);
        this.makeInteractive(image);
        sprite = { image, key };
        sprites.set(item.id, sprite);
      }
      if (sprite.key !== key) {
        sprite.image.setTexture(key);
        sprite.key = key;
      }
      sprite.image.setData('furnitureId', item.id);
      const pos = furnitureCenter(item);
      sprite.image
        .setPosition(pos.x, pos.y)
        .setRotation(isWallMounted(item.kind) ? 0 : Phaser.Math.DegToRad(item.rotation ?? 0))
        .setDepth(this.host.depthOf(item));
      const bad = this.editor.problemOf(item) || state.flagged.includes(item.id);
      if (bad) sprite.image.setTint(0xff9a9a);
      else sprite.image.clearTint();

      if (FURNITURE[item.kind].solid && !isWallMounted(item.kind)) {
        const b = itemBounds(item);
        const shadowKey = ensureShadowTexture(scene, item, textureScale);
        sprite.shadow ??= scene.add.image(0, 0, shadowKey).setOrigin(0).setScale(1 / textureScale).setDepth(this.host.shadowDepth);
        sprite.shadow.setTexture(shadowKey).setPosition(b.x * TILE + 1, b.y * TILE + 4);
      } else if (sprite.shadow) {
        sprite.shadow.destroy();
        delete sprite.shadow;
      }
    }
    for (const [id, sprite] of sprites) {
      if (seen.has(id)) continue;
      sprite.image.destroy();
      sprite.shadow?.destroy();
      sprites.delete(id);
    }

    // Selection and flagged outlines.
    this.outline.clear();
    for (const id of state.flagged) this.drawOutline(id, 0xe11d48);
    for (const id of state.selectedIds) this.drawOutline(id, 0x10b981);

    if (!state.placing) {
      this.ghost?.destroy();
      this.ghost = null;
    }
  }

  private drawOutline(id: string, color: number) {
    const item = this.editor.item(id);
    if (!item) return;
    const b = itemBounds(item);
    this.outline.lineStyle(2, color, 1);
    this.outline.strokeRoundedRect(b.x * TILE - 4, b.y * TILE - 4, b.w * TILE + 8, b.h * TILE + 8, 8);
    this.outline.fillStyle(color, 0.08);
    this.outline.fillRoundedRect(b.x * TILE - 4, b.y * TILE - 4, b.w * TILE + 8, b.h * TILE + 8, 8);
  }

  private updateGhost(pointer: Phaser.Input.Pointer) {
    const placing = this.editor.getState().placing!;
    let item: Furniture = {
      id: 'ghost',
      kind: placing.kind,
      x: Math.round((pointer.worldX / TILE) * 4) / 4,
      y: Math.round((pointer.worldY / TILE) * 4) / 4,
      w: placing.w,
      h: placing.h,
      color: placing.color,
    };
    if (isWallMounted(item.kind)) {
      const snapped = snapToWall(item, this.editor.layout.walls, 4);
      if (snapped) item = snapped;
    }
    const key = ensureFurnitureTexture(this.scene, item, this.host.textureScale);
    const pos = furnitureCenter(item);
    this.ghost ??= this.scene.add.image(0, 0, key).setScale(1 / this.host.textureScale).setDepth(999).setAlpha(0.75);
    this.ghost.setTexture(key).setPosition(pos.x, pos.y);
    this.ghost.setTint(this.editor.problemOf(item) ? 0xff8a8a : 0x9be7c4);
  }

  private makeInteractive(image: Phaser.GameObjects.Image) {
    image.setInteractive({ useHandCursor: true });
  }

  private problem(problem: PlacementProblem) {
    this.onProblem(PROBLEM_TEXT[problem]);
  }
}
