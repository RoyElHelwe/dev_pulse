import * as Phaser from 'phaser';
import { drawCharacter, type Mood, type Pose } from '../art/character';
import { phaserPen } from '../art/pen';
import { encode, type Recipe } from '../art/recipe';
import { circle, rr } from '../render/draw';
import { Bubble } from './Bubble';

export type { Direction } from '../art/character';
import type { Direction } from '../art/character';

/** Network order of directions (0 down, 1 up, 2 left, 3 right). */
export const DIRECTIONS: Direction[] = ['down', 'up', 'left', 'right'];

/** Walk cycle drawn in 8 frames per stride: smooth enough, and far fewer redraws. */
const FRAME = Math.PI / 4;
/** A blink every ~3.7 s, for 120 ms. */
const BLINK_EVERY_MS = 3700;
const BLINK_MS = 120;

/** Frame box around the feet (0, 0), in world pixels: wide enough for an afro and a headset. */
const BOX = { left: 26, top: 64, width: 52, height: 72 };

/**
 * Each frame (direction, step, blink, mood...) is drawn once into a texture
 * shared by everyone with the same recipe, then shown as an image: Phaser
 * replays a Graphics object's shapes every frame, a texture costs nothing.
 */
function frameTexture(scene: Phaser.Scene, code: string, recipe: Recipe, frame: string, pose: Pose, scale: number) {
  const key = `avatar:${code}:${frame}:${scale}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  drawCharacter(phaserPen(g), recipe, pose);
  const texture = scene.textures.addDynamicTexture(key, Math.ceil(BOX.width * scale), Math.ceil(BOX.height * scale))!;
  g.setScale(scale).setPosition(BOX.left * scale, BOX.top * scale);
  texture.draw(g);
  g.destroy();
  return key;
}

/** What a status says about the face: focused, on a break (with a mug)... */
function moodOf(status: string | null): { mood: Mood; mug: boolean } {
  const s = status?.toLowerCase() ?? '';
  if (/break|coffee|lunch|☕/.test(s)) return { mood: 'happy', mug: true };
  if (/focus|deep work|heads? down/.test(s)) return { mood: 'focus', mug: false };
  if (/tired|sleep|zzz/.test(s)) return { mood: 'sleepy', mug: false };
  return { mood: 'neutral', mug: false };
}

/**
 * A character drawn from its recipe (game/art/character.ts) in 3/4 view, with
 * a walk cycle and a name tag. The container's (x, y) is the point between
 * the feet, which is also used for depth sorting and the physics body.
 */
export class Avatar extends Phaser.GameObjects.Container {
  private readonly figure: Phaser.GameObjects.Image;
  /** Texture pixels per world pixel (sharp on retina screens). */
  private readonly texScale: number;
  private code: string;
  private direction: Direction = 'down';
  private phase = 0;
  private moving = false;
  private status: Bubble | null = null;
  private statusText: string | null = null;
  private inCall = false;
  private talking = false;
  /** Own clock, offset so people don't all blink together. */
  private clock = Math.random() * BLINK_EVERY_MS;
  /** What was drawn last: skip redraws when nothing visible changed. */
  private drawn = '';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private recipe: Recipe,
    name: string,
    private readonly fontFamily: string,
    private readonly textResolution: number,
  ) {
    super(scene, x, y);

    const shadow = scene.add.graphics();
    shadow.fillStyle(0x000000, 0.16);
    shadow.fillEllipse(0, 0, 26, 9, 20);

    this.texScale = Math.min(3, textResolution * 0.75);
    this.code = encode(recipe);
    this.figure = scene.add
      .image(0, 0, '__DEFAULT')
      .setOrigin(BOX.left / BOX.width, BOX.top / BOX.height)
      .setScale(1 / this.texScale);

    const label = scene.add
      .text(0, -66, name, {
        fontFamily,
        fontSize: '11px',
        fontStyle: '600',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setResolution(textResolution);
    const tag = scene.add.graphics();
    const tagW = label.width + 24;
    rr(tag, -tagW / 2, -75, tagW, 18, 9, 0x18181b, 0.82);
    circle(tag, -tagW / 2 + 9.5, -66, 2.5, 0x34d399);
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
    this.direction = direction;
    // Kept within one stride, so the walk reuses the same 8 frames.
    this.phase = moving ? (this.phase + deltaMs * 0.018) % (Math.PI * 2) : 0;
    this.moving = moving;
    this.clock += deltaMs;
    this.redraw();
  }

  /** A short status in a bubble above the name ("On break", current task...). */
  setStatus(text: string | null | undefined) {
    this.statusText = text || null;
    this.redraw();
    if (!text) {
      this.status?.destroy();
      this.status = null;
      return;
    }
    if (this.status) this.status.setText(text);
    else {
      this.status = new Bubble(this.scene, 0, -78, text, {
        fontFamily: this.fontFamily,
        resolution: this.textResolution,
        tail: true,
        fontSize: 10,
      });
      this.add(this.status);
    }
  }

  setLook(recipe: Recipe) {
    this.recipe = recipe;
    this.code = encode(recipe);
    this.drawn = '';
    this.redraw();
  }

  /** In a voice call (headset on); `talking` blinks its light. For the voice features (Z3, Z4). */
  setInCall(inCall: boolean, talking = false) {
    this.inCall = inCall;
    this.talking = talking;
    this.redraw();
  }

  private redraw() {
    const frame = this.moving ? Math.round(this.phase / FRAME) % 8 : 0;
    const blink = !this.moving && this.clock % BLINK_EVERY_MS < BLINK_MS;
    const { mood, mug } = moodOf(this.statusText);
    const key = `${this.code}|${this.direction}|${frame}|${blink}|${mood}|${mug}|${this.inCall}|${this.talking}`;
    if (key === this.drawn) return;
    this.drawn = key;
    const texture = frameTexture(this.scene, this.code, this.recipe, key.slice(this.code.length + 1), {
      dir: this.direction,
      moving: this.moving,
      phase: frame * FRAME,
      blink,
      mood,
      mug,
      headset: this.inCall,
      talking: this.talking,
    }, this.texScale);
    this.figure.setTexture(texture);
  }
}
