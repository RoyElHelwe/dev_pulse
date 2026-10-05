import * as Phaser from 'phaser';
import { rr } from '../render/draw';

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

/**
 * A rounded label (status above an avatar, "Press E" hints, name plates).
 * The container's origin is the bottom centre of the bubble.
 */
export class Bubble extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly keyCap?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, private readonly o: BubbleOptions) {
    super(scene, x, y);
    this.bg = scene.add.graphics();
    const size = `${o.fontSize ?? 11}px`;
    this.label = scene.add
      .text(0, 0, text, { fontFamily: o.fontFamily, fontSize: size, fontStyle: '600', color: o.tone && o.tone !== 'light' ? '#ffffff' : '#27272a' })
      .setOrigin(0, 0.5)
      .setResolution(o.resolution);
    this.add([this.bg, this.label]);
    if (o.key) {
      this.keyCap = scene.add
        .text(0, 0, o.key, { fontFamily: o.fontFamily, fontSize: '10px', fontStyle: '700', color: '#18181b' })
        .setOrigin(0.5)
        .setResolution(o.resolution);
      this.add(this.keyCap);
    }
    this.layout();
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
    const g = this.bg;
    const top = -h - (this.o.tail ? 4 : 0);
    const [fill, alpha] = TONES[this.o.tone ?? 'light'];
    g.clear();
    if (!this.o.tone || this.o.tone === 'light') {
      g.fillStyle(0x000000, 0.12);
      g.fillRoundedRect(-w / 2, top + 1.5, w, h, h / 2);
    }
    rr(g, -w / 2, top, w, h, h / 2, fill, alpha);
    if (this.o.tail) {
      g.fillStyle(fill, alpha);
      g.fillTriangle(-4, top + h - 0.5, 4, top + h - 0.5, 0, top + h + 4);
    }
    let x = -w / 2 + 8;
    if (this.keyCap) {
      rr(g, x - 2, top + h / 2 - 8, 16, 16, 4, 0xf4f4f5);
      g.lineStyle(1, 0xd4d4d8, 1);
      g.strokeRoundedRect(x - 2, top + h / 2 - 8, 16, 16, 4);
      this.keyCap.setPosition(x + 6, top + h / 2);
      x += 20;
    }
    this.label.setPosition(x, top + h / 2);
  }
}
