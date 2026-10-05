import * as Phaser from 'phaser';
import { circle, rr, shade } from '../render/draw';
import { Bubble } from './Bubble';
import type { CharacterLook } from './looks';

export type Direction = 'down' | 'up' | 'left' | 'right';

/** Network order of directions (0 down, 1 up, 2 left, 3 right). */
export const DIRECTIONS: Direction[] = ['down', 'up', 'left', 'right'];

const SHOES = 0x1f2125;
const EYES = 0x2a2522;

/**
 * A character drawn in 3/4 view (front, back and side), with a walk cycle and
 * a name tag. The container's (x, y) is the point between the feet, which is
 * also used for depth sorting and the physics body.
 */
export class Avatar extends Phaser.GameObjects.Container {
  private readonly figure: Phaser.GameObjects.Graphics;
  private direction: Direction = 'down';
  private phase = 0;
  private moving = false;
  private status: Bubble | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private look: CharacterLook,
    name: string,
    private readonly fontFamily: string,
    private readonly textResolution: number,
  ) {
    super(scene, x, y);

    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.16);
    shadow.fillEllipse(0, 0, 26, 9, 20);

    this.figure = scene.add.graphics();

    const label = scene.add
      .text(0, -62, name, {
        fontFamily,
        fontSize: '11px',
        fontStyle: '600',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setResolution(textResolution);
    const tag = scene.add.graphics();
    const tagW = label.width + 24;
    rr(tag, -tagW / 2, -71, tagW, 18, 9, 0x18181b, 0.82);
    circle(tag, -tagW / 2 + 9.5, -62, 2.5, 0x34d399);
    label.setX(4.5);

    this.add([shadow, this.figure, tag, label]);
    scene.add.existing(this);
    this.redraw();
  }

  get facing(): Direction {
    return this.direction;
  }

  /** Call every frame with the current velocity (local player). */
  animate(vx: number, vy: number, deltaMs: number) {
    const moving = vx !== 0 || vy !== 0;
    const direction = moving
      ? Math.abs(vx) > Math.abs(vy)
        ? vx < 0
          ? 'left'
          : 'right'
        : vy < 0
          ? 'up'
          : 'down'
      : this.direction;
    this.animateAs(direction, moving, deltaMs);
  }

  /** Call every frame with a known direction (other players, from the network). */
  animateAs(direction: Direction, moving: boolean, deltaMs: number) {
    const changed = direction !== this.direction;
    this.direction = direction;
    this.phase = moving ? this.phase + deltaMs * 0.018 : 0;
    if (moving || this.moving || changed) this.redraw();
    this.moving = moving;
  }

  /** A short status in a bubble above the name ("On break", current task...). */
  setStatus(text: string | null | undefined) {
    if (!text) {
      this.status?.destroy();
      this.status = null;
      return;
    }
    if (this.status) this.status.setText(text);
    else {
      this.status = new Bubble(this.scene, 0, -74, text, {
        fontFamily: this.fontFamily,
        resolution: this.textResolution,
        tail: true,
        fontSize: 10,
      });
      this.add(this.status);
    }
  }

  setLook(look: CharacterLook) {
    this.look = look;
    this.redraw();
  }

  private redraw() {
    const g = this.figure;
    const { skin, hair, top, bottom } = this.look;
    const dir = this.direction;
    const swing = Math.sin(this.phase);
    const bob = this.moving ? Math.abs(Math.cos(this.phase)) * 1.5 : 0;
    const side = dir === 'left' || dir === 'right';
    const facing = dir === 'left' ? -1 : 1;

    g.clear();

    // Legs and shoes.
    if (side) {
      const back = -swing * 3.5 * facing;
      const front = swing * 3.5 * facing;
      rr(g, back - 3, -14, 6, 12, 3, shade(bottom, -0.25));
      rr(g, back - 3 + facing, -4, 7, 4, 2, SHOES);
      rr(g, front - 3, -14, 6, 12, 3, bottom);
      rr(g, front - 3 + facing, -4, 7, 4, 2, SHOES);
    } else {
      const lift = this.moving ? swing * 1.8 : 0;
      rr(g, -7, -14 - lift, 6, 12, 3, bottom);
      rr(g, 1, -14 + lift, 6, 12, 3, bottom);
      rr(g, -7.5, -4 - lift, 7, 4, 2, SHOES);
      rr(g, 0.5, -4 + lift, 7, 4, 2, SHOES);
    }

    // Body.
    const ty = -30 - bob;
    const sleeve = shade(top, -0.12);
    if (side) {
      rr(g, -8, ty, 16, 18, 6, top);
      rr(g, -8 + (facing < 0 ? 11 : 0), ty + 2, 5, 15, 3, shade(top, -0.08));
      // One arm swinging.
      const ax = swing * 4 * facing;
      rr(g, ax - 2.5, ty + 3, 5, 13, 2.5, sleeve);
      circle(g, ax, ty + 16.5, 2.6, skin);
    } else {
      rr(g, -10, ty, 20, 18, 7, top);
      g.fillStyle(0x000000, 0.08);
      g.fillRect(-10, ty + 13, 20, 3);
      const arm = this.moving ? swing * 2 : 0;
      rr(g, -14, ty + 2 + arm, 5, 13, 2.5, sleeve);
      rr(g, 9, ty + 2 - arm, 5, 13, 2.5, sleeve);
      circle(g, -11.5, ty + 15.5 + arm, 2.6, skin);
      circle(g, 11.5, ty + 15.5 - arm, 2.6, skin);
      if (dir === 'down') rr(g, -3, ty - 1, 6, 4, 2, shade(skin, -0.1)); // neck
    }

    // Head.
    const hy = ty - 9;
    this.drawHair(g, hy, 'behind');
    circle(g, 0, hy, 9.5, skin);
    this.drawHair(g, hy, 'front');
    g.fillStyle(EYES, 1);
    if (dir === 'down') {
      g.fillCircle(-3.4, hy + 1.8, 1.3);
      g.fillCircle(3.4, hy + 1.8, 1.3);
      g.fillStyle(0xe58c8a, 0.35);
      g.fillCircle(-5.5, hy + 4.5, 1.8);
      g.fillCircle(5.5, hy + 4.5, 1.8);
    } else if (side) {
      g.fillCircle(4.8 * facing, hy + 1.8, 1.3);
    }
  }

  /** Hair is drawn in two passes: what is behind the head, then what covers it. */
  private drawHair(g: Phaser.GameObjects.Graphics, hy: number, pass: 'behind' | 'front') {
    const { hair, hairStyle } = this.look;
    const dir = this.direction;
    const facing = dir === 'left' ? -1 : 1;

    if (pass === 'behind') {
      if (hairStyle === 'long') {
        if (dir === 'down') rr(g, -11, hy - 2, 22, 17, 6, shade(hair, -0.1));
        if (dir === 'left' || dir === 'right') rr(g, -facing * 9 - 5, hy - 2, 10, 16, 5, hair);
      }
      if (hairStyle === 'bun' && dir !== 'up') circle(g, 0, hy - 10, 4.8, hair);
      return;
    }

    g.fillStyle(hair, 1);
    if (dir === 'up') {
      g.fillCircle(0, hy - 0.5, 10);
      if (hairStyle === 'long') rr(g, -10, hy, 20, 16, 6, hair);
      if (hairStyle === 'bun') circle(g, 0, hy - 6, 5, shade(hair, 0.08));
    } else if (dir === 'down') {
      g.slice(0, hy, 10, Math.PI, Math.PI * 2, false);
      g.fillPath();
      rr(g, -9.8, hy - 3.5, 19.6, 4.5, 2, hair);
      if (hairStyle !== 'short') rr(g, -9.8, hy - 3, 3.5, 7, 1.5, hair);
    } else {
      // Side view: hair covers the top and the back of the head.
      g.slice(0, hy, 10, Math.PI, Math.PI * 2, false);
      g.fillPath();
      g.fillCircle(-facing * 3, hy - 1, 8.5);
      rr(g, facing > 0 ? -1 : -9, hy - 3.5, 10, 3, 1.5, hair);
    }
    if (hairStyle === 'curly') {
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        circle(g, Math.cos(a) * 9.5, hy + Math.sin(a) * 9.5, 3.4, hair);
      }
    }
  }
}
