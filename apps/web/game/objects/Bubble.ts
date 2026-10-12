/**
 * Speech and prompt bubble display objects.
 * Uses shared ref-counted cached textures for backgrounds to eliminate per-bubble render graphics.
 */

import * as Phaser from 'phaser';
import { rr } from '../render/draw';
import { acquireShape, releaseShape, shapeImage, shapeScale, type ShapeBounds } from '../render/shapes';

const TONES = { light: [0xffffff, 0.97], dark: [0x18181b, 0.82], accent: [0x059669, 0.92] } as const;

// ---- Speech bubble layout metrics ------------------------------------------
const SPEECH_WRAP_WIDTH_PX = 150;
const SPEECH_MIN_WIDTH_PX = 28;
const SPEECH_PADDING_X_PX = 18;
const SPEECH_PADDING_Y_PX = 12;
const SPEECH_TOP_OFFSET_PX = 5;
const SPEECH_BOUNDS_PAD_X_PX = 2;
const SPEECH_BOUNDS_PAD_Y_PX = 2;
const SPEECH_BOUNDS_EXTRA_W_PX = 4;
const SPEECH_BOUNDS_EXTRA_H_PX = 12;
const SPEECH_SHADOW_ALPHA = 0.12;
const SPEECH_SHADOW_OFFSET_Y_PX = 1.5;
const SPEECH_CORNER_RADIUS_PX = 10;
const SPEECH_BG_COLOR = 0xffffff;
const SPEECH_BG_ALPHA = 0.98;
const SPEECH_TAIL_HALF_WIDTH_PX = 4;
const SPEECH_TAIL_HEIGHT_PX = 5;
const SPEECH_LABEL_OFFSET_Y_PX = 6;

// ---- Hint & status bubble layout metrics -----------------------------------
const BUBBLE_DEFAULT_FONT_SIZE_PX = 11;
const BUBBLE_HEIGHT_PAD_PX = 10;
const BUBBLE_PADDING_WITH_KEY_PX = 30;
const BUBBLE_PADDING_WITHOUT_KEY_PX = 16;
const BUBBLE_TAIL_OFFSET_Y_PX = 4;
const BUBBLE_BOUNDS_PAD_PX = 2;
const BUBBLE_BOUNDS_EXTRA_W_PX = 4;
const BUBBLE_BOUNDS_EXTRA_H_PX = 4;
const BUBBLE_SHADOW_ALPHA = 0.12;
const BUBBLE_SHADOW_OFFSET_Y_PX = 1.5;
const BUBBLE_TAIL_HALF_WIDTH_PX = 4;
const BUBBLE_TAIL_HEIGHT_PX = 4;

// ---- Keycap badge layout metrics -------------------------------------------
const KEYCAP_INSET_X_PX = 8;
const KEYCAP_SIZE_PX = 16;
const KEYCAP_RADIUS_PX = 4;
const KEYCAP_BG_COLOR = 0xf4f4f5;
const KEYCAP_BORDER_COLOR = 0xd4d4d8;
const KEYCAP_LABEL_OFFSET_X_PX = 6;
const KEYCAP_LABEL_SHIFT_X_PX = 20;

interface BubbleOptions {
  fontFamily: string;
  resolution: number;
  /** Small key cap drawn before the text (e.g. "E"). */
  key?: string;
  tone?: 'light' | 'dark' | 'accent';
  /** Draw a little tail under the bubble. */
  tail?: boolean;
  fontSize?: number;
}

function setShapeTexture(img: Phaser.GameObjects.Image, textures: Phaser.Textures.TextureManager, key: string, bounds: ShapeBounds, scale: number) {
  const frame = textures.getFrame(key);
  img.setTexture(key);
  img.setOrigin((-bounds.x * scale) / frame.width, (-bounds.y * scale) / frame.height);
  img.setScale(1 / scale);
}

/**
 * A chat message over someone's head: wrapped text in a rounded white bubble with a
 * tail. The container's origin is the bottom centre of the tail tip.
 */
export class SpeechBubble extends Phaser.GameObjects.Container {
  private readonly textures: Phaser.Textures.TextureManager;
  private bgKey?: string;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, o: { fontFamily: string; resolution: number }) {
    super(scene, x, y);
    this.textures = scene.textures;
    const label = scene.add
      .text(0, 0, text, {
        fontFamily: o.fontFamily,
        fontSize: '11px',
        fontStyle: '500',
        color: '#27272a',
        wordWrap: { width: SPEECH_WRAP_WIDTH_PX, useAdvancedWrap: true },
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setResolution(o.resolution);
    const w = Math.max(SPEECH_MIN_WIDTH_PX, label.width + SPEECH_PADDING_X_PX);
    const h = label.height + SPEECH_PADDING_Y_PX;
    const top = -h - SPEECH_TOP_OFFSET_PX;
    const bounds: ShapeBounds = { x: -w / 2 - SPEECH_BOUNDS_PAD_X_PX, y: top - SPEECH_BOUNDS_PAD_Y_PX, w: w + SPEECH_BOUNDS_EXTRA_W_PX, h: h + SPEECH_BOUNDS_EXTRA_H_PX };
    const scale = shapeScale(o.resolution);
    // WHY: Shapes are baked into ref-counted cached textures (render/shapes.ts) instead of persistent Graphics objects to avoid draw calls and per-frame allocations.
    this.bgKey = acquireShape(scene, `speech:${w.toFixed(2)}:${h}`, bounds, scale, (bg) => {
      bg.fillStyle(0x000000, SPEECH_SHADOW_ALPHA);
      bg.fillRoundedRect(-w / 2, top + SPEECH_SHADOW_OFFSET_Y_PX, w, h, SPEECH_CORNER_RADIUS_PX);
      rr(bg, -w / 2, top, w, h, SPEECH_CORNER_RADIUS_PX, SPEECH_BG_COLOR, SPEECH_BG_ALPHA);
      bg.fillStyle(SPEECH_BG_COLOR, SPEECH_BG_ALPHA);
      bg.fillTriangle(-SPEECH_TAIL_HALF_WIDTH_PX, top + h - 0.5, SPEECH_TAIL_HALF_WIDTH_PX, top + h - 0.5, 0, top + h + SPEECH_TAIL_HEIGHT_PX);
    });
    const bg = shapeImage(scene, this.bgKey, bounds, scale);
    label.setY(top + h - SPEECH_LABEL_OFFSET_Y_PX);
    this.add([bg, label]);
    scene.add.existing(this);
  }

  /** Cleans up the speech bubble and releases its cached background texture. */
  destroy(fromScene?: boolean) {
    if (this.bgKey) {
      releaseShape(this.textures, this.bgKey);
      this.bgKey = undefined;
    }
    super.destroy(fromScene);
  }
}

/**
 * A rounded label (status above an avatar, "Press E" hints, name plates).
 * The container's origin is the bottom centre of the bubble.
 */
export class Bubble extends Phaser.GameObjects.Container {
  private readonly textures: Phaser.Textures.TextureManager;
  private bgKey?: string;
  private bg!: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly keyCap?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, private readonly o: BubbleOptions) {
    super(scene, x, y);
    this.textures = scene.textures;
    const size = `${o.fontSize ?? BUBBLE_DEFAULT_FONT_SIZE_PX}px`;
    this.label = scene.add
      .text(0, 0, text, { fontFamily: o.fontFamily, fontSize: size, fontStyle: '600', color: o.tone && o.tone !== 'light' ? '#ffffff' : '#27272a' })
      .setOrigin(0, 0.5)
      .setResolution(o.resolution);
    if (o.key) {
      this.keyCap = scene.add
        .text(0, 0, o.key, { fontFamily: o.fontFamily, fontSize: '10px', fontStyle: '700', color: '#18181b' })
        .setOrigin(0.5)
        .setResolution(o.resolution);
    }
    this.layout();
    this.add([this.bg, this.label]);
    if (this.keyCap) {
      this.add(this.keyCap);
    }
    scene.add.existing(this);
  }

  /** Updates the bubble label text and recalculates background geometry. */
  setText(text: string) {
    if (this.label.text === text) return this;
    this.label.setText(text);
    this.layout();
    return this;
  }

  /** Width and height in pixels, for interaction hit testing. */
  get box() {
    return {
      w: this.label.width + (this.keyCap ? BUBBLE_PADDING_WITH_KEY_PX : BUBBLE_PADDING_WITHOUT_KEY_PX),
      h: (this.o.fontSize ?? BUBBLE_DEFAULT_FONT_SIZE_PX) + BUBBLE_HEIGHT_PAD_PX,
    };
  }

  private layout() {
    const { w, h } = this.box;
    const top = -h - (this.o.tail ? BUBBLE_TAIL_OFFSET_Y_PX : 0);
    const tone = this.o.tone ?? 'light';
    const [fill, alpha] = TONES[tone];
    const isLight = !this.o.tone || this.o.tone === 'light';
    const extraY = this.o.tail ? BUBBLE_TAIL_OFFSET_Y_PX : isLight ? BUBBLE_SHADOW_OFFSET_Y_PX : 0;
    const bounds: ShapeBounds = { x: -w / 2 - BUBBLE_BOUNDS_PAD_PX, y: top - BUBBLE_BOUNDS_PAD_PX, w: w + BUBBLE_BOUNDS_EXTRA_W_PX, h: h + extraY + BUBBLE_BOUNDS_EXTRA_H_PX };
    const tail = this.o.tail ? 1 : 0;
    const hasKey = this.o.key ? 1 : 0;
    const fontSize = this.o.fontSize ?? BUBBLE_DEFAULT_FONT_SIZE_PX;
    const key = `bubble:${tone}:${tail}:${hasKey}:${fontSize}:${w.toFixed(2)}:${h}`;
    const scale = shapeScale(this.o.resolution);

    const prevKey = this.bgKey;
    const fullKey = `shape:${key}:${scale}`;
    if (prevKey !== fullKey) {
      // WHY: Shapes are baked into ref-counted cached textures (render/shapes.ts) instead of persistent Graphics objects to avoid draw calls and per-frame allocations.
      const newKey = acquireShape(this.scene, key, bounds, scale, (g) => {
        if (isLight) {
          g.fillStyle(0x000000, BUBBLE_SHADOW_ALPHA);
          g.fillRoundedRect(-w / 2, top + BUBBLE_SHADOW_OFFSET_Y_PX, w, h, h / 2);
        }
        rr(g, -w / 2, top, w, h, h / 2, fill, alpha);
        if (this.o.tail) {
          g.fillStyle(fill, alpha);
          g.fillTriangle(-BUBBLE_TAIL_HALF_WIDTH_PX, top + h - 0.5, BUBBLE_TAIL_HALF_WIDTH_PX, top + h - 0.5, 0, top + h + BUBBLE_TAIL_HEIGHT_PX);
        }
        if (this.keyCap) {
          const kx = -w / 2 + KEYCAP_INSET_X_PX;
          rr(g, kx - 2, top + h / 2 - 8, KEYCAP_SIZE_PX, KEYCAP_SIZE_PX, KEYCAP_RADIUS_PX, KEYCAP_BG_COLOR);
          g.lineStyle(1, KEYCAP_BORDER_COLOR, 1);
          g.strokeRoundedRect(kx - 2, top + h / 2 - 8, KEYCAP_SIZE_PX, KEYCAP_SIZE_PX, KEYCAP_RADIUS_PX);
        }
      });
      if (prevKey) {
        releaseShape(this.textures, prevKey);
      }
      this.bgKey = newKey;

      if (!this.bg) {
        this.bg = shapeImage(this.scene, newKey, bounds, scale);
      } else {
        setShapeTexture(this.bg, this.textures, newKey, bounds, scale);
      }
    }

    let x = -w / 2 + KEYCAP_INSET_X_PX;
    if (this.keyCap) {
      this.keyCap.setPosition(x + KEYCAP_LABEL_OFFSET_X_PX, top + h / 2);
      x += KEYCAP_LABEL_SHIFT_X_PX;
    }
    this.label.setPosition(x, top + h / 2);
  }

  /** Cleans up the bubble container and releases cached shape textures. */
  destroy(fromScene?: boolean) {
    if (this.bgKey) {
      releaseShape(this.textures, this.bgKey);
      this.bgKey = undefined;
    }
    super.destroy(fromScene);
  }
}
