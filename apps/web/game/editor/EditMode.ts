import * as Phaser from 'phaser';
import { TILE } from '../constants';
import { itemBounds } from '../layout/derive';
import type { Furniture } from '../layout/types';
import { FURNITURE } from '../render/furniture';
import { ensureFurnitureTexture, ensureShadowTexture } from '../render/sprites';
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
  private drag: { id: string; dx: number; dy: number } | null = null;
  private panning = false;
  private unsubscribe: () => void;

  constructor(
    private readonly host: EditModeHost,
    private readonly editor: LayoutEditor,
    private readonly onProblem: (text: string) => void,
  ) {
    this.scene = host.scene;
    this.outline = this.scene.add.graphics().setDepth(1000);
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
    const id = over.map((o) => o.getData('furnitureId') as string | undefined).find(Boolean);
    if (id) {
      const item = this.editor.item(id)!;
      this.editor.select(id);
      this.editor.beginDrag();
      this.drag = { id, dx: item.x * TILE - pointer.worldX, dy: item.y * TILE - pointer.worldY };
      this.scene.input.setDefaultCursor('grabbing');
    } else {
      this.editor.select(null);
      this.panning = true;
      this.scene.input.setDefaultCursor('grabbing');
    }
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    if (this.drag) {
      this.editor.dragTo(this.drag.id, (pointer.worldX + this.drag.dx) / TILE, (pointer.worldY + this.drag.dy) / TILE);
    } else if (this.panning && pointer.isDown) {
      const cam = this.scene.cameras.main;
      cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
      cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
    } else if (this.editor.getState().placing) {
      this.updateGhost(pointer);
    }
  }

  private onUp() {
    if (this.drag) {
      const problem = this.editor.endDrag(this.drag.id);
      if (problem) this.problem(problem);
    }
    this.drag = null;
    this.panning = false;
    this.scene.input.setDefaultCursor('default');
  }

  // ---- keyboard -------------------------------------------------------------------

  private onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const { selectedId, placing } = this.editor.getState();
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
    } else if (selectedId && mod && key === 'd') {
      event.preventDefault();
      problem = this.editor.duplicate(selectedId);
    } else if (selectedId && (key === 'delete' || key === 'backspace')) {
      event.preventDefault();
      this.editor.remove(selectedId);
    } else if (selectedId && key === 'r') {
      problem = this.editor.rotate(selectedId, !event.shiftKey);
    } else if (key.startsWith('arrow')) {
      event.preventDefault();
      const step = event.shiftKey ? 1 : 0.25;
      const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
      const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
      if (selectedId) {
        problem = this.editor.nudge(selectedId, dx, dy);
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
      sprite.image
        .setPosition(item.x * TILE, item.y * TILE)
        .setRotation(Phaser.Math.DegToRad(item.rotation ?? 0))
        .setDepth(this.host.depthOf(item));
      const bad = this.editor.problemOf(item) || state.flagged.includes(item.id);
      if (bad) sprite.image.setTint(0xff9a9a);
      else sprite.image.clearTint();

      if (FURNITURE[item.kind].solid) {
        const b = itemBounds(item);
        const shadowKey = ensureShadowTexture(scene, item, textureScale);
        sprite.shadow ??= scene.add.image(0, 0, shadowKey).setOrigin(0).setScale(1 / textureScale).setDepth(this.host.shadowDepth);
        sprite.shadow.setTexture(shadowKey).setPosition(b.x * TILE + 1, b.y * TILE + 4);
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
    if (state.selectedId) this.drawOutline(state.selectedId, 0x10b981);

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
    const item: Furniture = {
      id: 'ghost',
      kind: placing.kind,
      x: Math.round((pointer.worldX / TILE) * 4) / 4,
      y: Math.round((pointer.worldY / TILE) * 4) / 4,
      w: placing.w,
      h: placing.h,
      color: placing.color,
    };
    const key = ensureFurnitureTexture(this.scene, item, this.host.textureScale);
    this.ghost ??= this.scene.add.image(0, 0, key).setScale(1 / this.host.textureScale).setDepth(999).setAlpha(0.75);
    this.ghost.setTexture(key).setPosition(item.x * TILE, item.y * TILE);
    this.ghost.setTint(this.editor.problemOf(item) ? 0xff8a8a : 0x9be7c4);
  }

  private makeInteractive(image: Phaser.GameObjects.Image) {
    image.setInteractive({ useHandCursor: true });
  }

  private problem(problem: PlacementProblem) {
    this.onProblem(PROBLEM_TEXT[problem]);
  }
}
