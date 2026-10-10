import * as Phaser from 'phaser';
import { drawCharacter, type Mood, type Pose } from '../art/character';
import { phaserPen } from '../art/pen';
import { encode, type Recipe } from '../art/recipe';
import { circle, rr } from '../render/draw';
import { acquireShape, releaseShape, shapeImage, shapeScale } from '../render/shapes';
import { Bubble, SpeechBubble } from './Bubble';

/** Chat bubbles show at most this many characters. */
const SAY_MAX = 80;

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

const MOODS: Mood[] = ['neutral', 'happy', 'focus', 'sleepy'];

let budgetEnd = 0;

export function beginTextureBudget(ms = 3) {
  budgetEnd = performance.now() + ms;
}

/**
 * Each frame (direction, step, blink, mood...) is drawn once into a texture
 * shared by everyone with the same recipe, then shown as an image: Phaser
 * replays a Graphics object's shapes every frame, a texture costs nothing.
 */
function frameTexture(
  scene: Phaser.Scene,
  code: string,
  recipe: Recipe,
  frame: number,
  pose: Pose,
  scale: number,
  force = false,
): string | null {
  const key = `avatar:${code}:${frame}:${scale}`;
  if (scene.textures.exists(key)) return key;
  if (!force && performance.now() >= budgetEnd) return null;
  const g = scene.make.graphics({}, false);
  drawCharacter(phaserPen(g), recipe, pose);
  const texture = scene.textures.addDynamicTexture(key, Math.ceil(BOX.width * scale), Math.ceil(BOX.height * scale))!;
  g.setScale(scale).setPosition(BOX.left * scale, BOX.top * scale);
  texture.draw(g);
  g.destroy();
  return key;
}

/** How many avatars wear each recipe: its frames are freed when the last one goes. */
const wearers = new Map<string, number>();

function wear(code: string) {
  wearers.set(code, (wearers.get(code) ?? 0) + 1);
}

function unwear(textures: Phaser.Textures.TextureManager, code: string) {
  const left = (wearers.get(code) ?? 1) - 1;
  if (left > 0) return void wearers.set(code, left);
  wearers.delete(code);
  for (const key of textures.getTextureKeys()) if (key.startsWith(`avatar:${code}:`)) textures.remove(key);
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
  private readonly textures: Phaser.Textures.TextureManager;
  private shadowKey?: string;
  private tagKey?: string;
  private readonly figure: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  /** Texture pixels per world pixel (sharp on retina screens). */
  private readonly texScale: number;
  private code: string;
  private direction: Direction = 'down';
  private phase = 0;
  private moving = false;
  private _seated = false;
  private status: Bubble | null = null;
  private speech: SpeechBubble | null = null;
  private speechTimer: Phaser.Time.TimerEvent | null = null;
  private speechTween: Phaser.Tweens.Tween | null = null;
  private face = moodOf(null);
  private inCall = false;
  private talking = false;
  /** Own clock, offset so people don't all blink together. */
  private clock = Math.random() * BLINK_EVERY_MS;
  /** Frame drawn last (see redraw): skip redraws when nothing visible changed. */
  private drawn = -1;
  private hasTexture = false;

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

    this.textures = scene.textures;
    const shapeRes = shapeScale(textResolution);

    const shadowBounds = { x: -14, y: -5.5, w: 28, h: 11 };
    this.shadowKey = acquireShape(scene, 'shadow', shadowBounds, shapeRes, (g) => {
      g.fillStyle(0x000000, 0.16);
      g.fillEllipse(0, 0, 26, 9, 20);
    });
    this.shadow = shapeImage(scene, this.shadowKey, shadowBounds, shapeRes);

    this.texScale = Math.min(2, textResolution * 0.75);
    this.code = encode(recipe);
    wear(this.code);
    this.figure = scene.add
      .image(0, 0, '__DEFAULT')
      .setOrigin(BOX.left / BOX.width, BOX.top / BOX.height)
      .setScale(1 / this.texScale)
      .setVisible(false);

    const label = scene.add
      .text(0, -66, name, {
        fontFamily,
        fontSize: '11px',
        fontStyle: '600',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setResolution(textResolution);
    const tagW = label.width + 24;
    const tagBounds = { x: -tagW / 2 - 1, y: -76, w: tagW + 2, h: 20 };
    this.tagKey = acquireShape(scene, `tag:${tagW.toFixed(2)}`, tagBounds, shapeRes, (g) => {
      rr(g, -tagW / 2, -75, tagW, 18, 9, 0x18181b, 0.82);
      circle(g, -tagW / 2 + 9.5, -66, 2.5, 0x34d399);
    });
    const tag = shapeImage(scene, this.tagKey, tagBounds, shapeRes);
    label.setX(4.5);

    this.add([this.shadow, this.figure, tag, label]);
    scene.add.existing(this);
    this.redraw();
  }

  get facing(): Direction {
    return this.direction;
  }

  get seated(): boolean {
    return this._seated;
  }

  setSeated(seated: boolean) {
    if (seated === this._seated) return;
    this._seated = seated;
    this.shadow.setVisible(!seated);
    this.redraw();
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
    if (this._seated) moving = false;
    this.direction = direction;
    // Kept within one stride, so the walk reuses the same 8 frames.
    this.phase = moving ? (this.phase + deltaMs * 0.018) % (Math.PI * 2) : 0;
    this.moving = moving;
    this.clock += deltaMs;
    this.redraw();
  }

  /** A short status in a bubble above the name ("On break", current task...). */
  setStatus(text: string | null | undefined) {
    this.face = moodOf(text || null);
    this.redraw();
    if (!text) {
      this.status?.destroy();
      this.status = null;
      this.speech?.setY(this.speechY());
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
    this.speech?.setY(this.speechY());
  }

  /** A chat message over the head, above the status: shown for ~5 s plus its length, then fades. Newest replaces. */
  say(message: string) {
    const text = message.replace(/\s+/g, ' ').trim();
    if (!text) return;
    this.clearSpeech();
    const shown = text.length > SAY_MAX ? `${text.slice(0, SAY_MAX - 1).trimEnd()}…` : text;
    this.speech = new SpeechBubble(this.scene, 0, this.speechY(), shown, { fontFamily: this.fontFamily, resolution: this.textResolution });
    this.add(this.speech);
    const bubble = this.speech;
    this.speechTimer = this.scene.time.delayedCall(4500 + shown.length * 40, () => {
      this.speechTween = this.scene.tweens.add({
        targets: bubble,
        alpha: 0,
        duration: 350,
        onComplete: () => {
          if (this.speech === bubble) this.clearSpeech();
        },
      });
    });
  }

  private speechY() {
    // Above the status bubble (about 24 px tall) when there is one, else above the name tag.
    return this.status ? -106 : -79;
  }

  private clearSpeech() {
    this.speechTimer?.remove(false);
    this.speechTween?.stop();
    this.speechTimer = null;
    this.speechTween = null;
    this.speech?.destroy();
    this.speech = null;
  }

  setLook(recipe: Recipe) {
    const code = encode(recipe);
    if (code === this.code) return;
    wear(code);
    unwear(this.scene.textures, this.code);
    this.recipe = recipe;
    this.code = code;
    this.drawn = -1;
    // Forced: the old look's textures were just freed, the figure must not keep pointing at them.
    this.redraw(true);
  }

  destroy(fromScene?: boolean) {
    const textures = this.scene?.textures ?? this.textures;
    this.speechTimer?.remove(false);
    this.speechTween?.stop();
    super.destroy(fromScene);
    if (textures) {
      unwear(textures, this.code);
      if (this.shadowKey) {
        releaseShape(textures, this.shadowKey);
        this.shadowKey = undefined;
      }
      if (this.tagKey) {
        releaseShape(textures, this.tagKey);
        this.tagKey = undefined;
      }
    }
  }

  /** In a voice call (headset on); `talking` blinks its light. For the voice features (Z3, Z4). */
  setInCall(inCall: boolean, talking = false) {
    this.inCall = inCall;
    this.talking = talking;
    this.redraw();
  }

  show() {
    this.redraw(true);
  }

  prebake() {
    for (const dir of DIRECTIONS) {
      for (let step = 0; step <= 8; step++) {
        const { frame, pose } = this.frameFor(step, 0, 0, dir);
        frameTexture(this.scene, this.code, this.recipe, frame, pose, this.texScale, true);
      }
    }
  }

  private frameFor(step: number, blink: number, talk: number, direction: Direction): { frame: number; pose: Pose } {
    const { mood, mug } = this.face;
    const frame =
      step +
      9 * (blink + 2 * (talk + 3 * (DIRECTIONS.indexOf(direction) + 4 * (MOODS.indexOf(mood) + 4 * (Number(mug) + 2 * Number(this.inCall)))))) +
      3456 * Number(this._seated);
    const pose: Pose = {
      dir: direction,
      moving: !this._seated && step > 0,
      seated: this._seated,
      phase: Math.max(0, step - 1) * FRAME,
      blink: blink === 1,
      mood,
      mug,
      headset: this.inCall,
      talking: this.talking,
      // Two light/mouth positions while talking.
      time: talk ? (talk - 1) * 250 : undefined,
    };
    return { frame, pose };
  }

  redraw(force = false) {
    // Everything visible, packed in one number: step (0 standing, 1-8 walking),
    // blink, talking light, direction, mood, mug, headset.
    const step = !this._seated && this.moving ? 1 + (Math.round(this.phase / FRAME) % 8) : 0;
    const blink = !this.moving && this.clock % BLINK_EVERY_MS < BLINK_MS ? 1 : 0;
    const talk = this.talking ? 1 + (Math.floor(this.clock / 160) % 2) : 0;
    const { frame, pose } = this.frameFor(step, blink, talk, this.direction);
    if (!force && frame === this.drawn) return;
    const texture = frameTexture(this.scene, this.code, this.recipe, frame, pose, this.texScale, force);
    if (!texture) return;
    this.drawn = frame;
    this.figure.setTexture(texture);
    if (!this.hasTexture) {
      this.hasTexture = true;
      this.figure.setVisible(true);
    }
  }
}
