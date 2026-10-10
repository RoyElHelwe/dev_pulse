import * as Phaser from 'phaser';
import { rr } from '../render/draw';
import { acquireShape, releaseShape, shapeImage, shapeScale, type ShapeBounds } from '../render/shapes';

const TONES = { light: [0xffffff, 0.97], dark: [0x18181b, 0.82], accent: [0x059669, 0.92] } as const;

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
        wordWrap: { width: 150, useAdvancedWrap: true },
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setResolution(o.resolution);
    const w = Math.max(28, label.width + 18);
    const h = label.height + 12;
    const top = -h - 5;
    const bounds: ShapeBounds = { x: -w / 2 - 2, y: top - 2, w: w + 4, h: h + 12 };
    const scale = shapeScale(o.resolution);
    this.bgKey = acquireShape(scene, `speech:${w.toFixed(2)}:${h}`, bounds, scale, (bg) => {
      bg.fillStyle(0x000000, 0.12);
      bg.fillRoundedRect(-w / 2, top + 1.5, w, h, 10);
      rr(bg, -w / 2, top, w, h, 10, 0xffffff, 0.98);
      bg.fillStyle(0xffffff, 0.98);
      bg.fillTriangle(-4, top + h - 0.5, 4, top + h - 0.5, 0, top + h + 5);
    });
    const bg = shapeImage(scene, this.bgKey, bounds, scale);
    label.setY(top + h - 6);
    this.add([bg, label]);
    scene.add.existing(this);
  }

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
    const size = `${o.fontSize ?? 11}px`;
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

  setText(text: string) {
    if (this.label.text === text) return this;
    this.label.setText(text);
    this.layout();
    return this;
  }

  /** Width and height, for hit areas. */
  get box() {
    return { w: this.label.width + (this.keyCap ? 30 : 16), h: (this.o.fontSize ?? 11) + 10 };
  }

  private layout() {
    const { w, h } = this.box;
    const top = -h - (this.o.tail ? 4 : 0);
    const tone = this.o.tone ?? 'light';
    const [fill, alpha] = TONES[tone];
    const isLight = !this.o.tone || this.o.tone === 'light';
    const extraY = this.o.tail ? 4 : isLight ? 1.5 : 0;
    const bounds: ShapeBounds = { x: -w / 2 - 2, y: top - 2, w: w + 4, h: h + extraY + 4 };
    const tail = this.o.tail ? 1 : 0;
    const hasKey = this.o.key ? 1 : 0;
    const fontSize = this.o.fontSize ?? 11;
    const key = `bubble:${tone}:${tail}:${hasKey}:${fontSize}:${w.toFixed(2)}:${h}`;
    const scale = shapeScale(this.o.resolution);

    const prevKey = this.bgKey;
    const fullKey = `shape:${key}:${scale}`;
    if (prevKey !== fullKey) {
      const newKey = acquireShape(this.scene, key, bounds, scale, (g) => {
        if (isLight) {
          g.fillStyle(0x000000, 0.12);
          g.fillRoundedRect(-w / 2, top + 1.5, w, h, h / 2);
        }
        rr(g, -w / 2, top, w, h, h / 2, fill, alpha);
        if (this.o.tail) {
          g.fillStyle(fill, alpha);
          g.fillTriangle(-4, top + h - 0.5, 4, top + h - 0.5, 0, top + h + 4);
        }
        if (this.keyCap) {
          const kx = -w / 2 + 8;
          rr(g, kx - 2, top + h / 2 - 8, 16, 16, 4, 0xf4f4f5);
          g.lineStyle(1, 0xd4d4d8, 1);
          g.strokeRoundedRect(kx - 2, top + h / 2 - 8, 16, 16, 4);
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

    let x = -w / 2 + 8;
    if (this.keyCap) {
      this.keyCap.setPosition(x + 6, top + h / 2);
      x += 20;
    }
    this.label.setPosition(x, top + h / 2);
  }

  destroy(fromScene?: boolean) {
    if (this.bgKey) {
      releaseShape(this.textures, this.bgKey);
      this.bgKey = undefined;
    }
    super.destroy(fromScene);
  }
}
