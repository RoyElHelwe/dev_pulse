/**
 * Character avatar game object.
 * Renders animated 3/4 view character sprites, walk cycles, name tags, shadows, and status bubbles.
 */

import * as Phaser from 'phaser';
import { drawCharacter, type Mood, type Pose } from '../art/character';
import { phaserPen } from '../art/pen';
import { encode, type Recipe } from '../art/recipe';
import { circle, rr } from '../render/draw';
import { acquireShape, releaseShape, shapeImage, shapeScale } from '../render/shapes';
import { Bubble, SpeechBubble } from './Bubble';

/** Chat bubbles show at most this many characters. */
const SAY_MAX = 80;

/** Cardinal facing direction of a character avatar ('down' | 'up' | 'left' | 'right'). */
export type { Direction } from '../art/character';
import type { Direction } from '../art/character';

/** Network order of directions (0 down, 1 up, 2 left, 3 right). */
export const DIRECTIONS: Direction[] = ['down', 'up', 'left', 'right'];

/** Walk cycle drawn in 8 frames per stride: smooth enough, and far fewer redraws. */
const FRAME = Math.PI / 4;
const WALK_FRAME_COUNT = 8;
const WALK_PHASE_RATE = 0.018;

/** A blink every ~3.7 s, for 120 ms. */
const BLINK_EVERY_MS = 3700;
const BLINK_MS = 120;

/** Frame box around the feet (0, 0), in world pixels: wide enough for an afro and a headset. */
const BOX = { left: 26, top: 64, width: 52, height: 72 };

const MOODS: Mood[] = ['neutral', 'happy', 'focus', 'sleepy'];

const DEFAULT_TEXTURE_BUDGET_MS = 3;
let budgetEnd = 0;

// ---- Layout & rendering metrics --------------------------------------------
const SHADOW_BOUNDS = { x: -14, y: -5.5, w: 28, h: 11 };
const SHADOW_ALPHA = 0.16;
const SHADOW_ELLIPSE_W = 26;
const SHADOW_ELLIPSE_H = 9;

const MAX_TEX_SCALE = 2;
const TEX_SCALE_RATIO = 0.75;

const NAME_TAG_Y_PX = -66;
const NAME_TAG_PADDING_PX = 24;
const NAME_TAG_BOUNDS_Y_PX = -76;
const NAME_TAG_BOUNDS_H_PX = 20;
const NAME_TAG_BG_Y_PX = -75;
const NAME_TAG_BG_H_PX = 18;
const NAME_TAG_BG_RADIUS_PX = 9;
const NAME_TAG_BG_COLOR = 0x18181b;
const NAME_TAG_BG_ALPHA = 0.82;
const STATUS_DOT_OFFSET_X_PX = 9.5;
const STATUS_DOT_RADIUS_PX = 2.5;
const STATUS_DOT_COLOR = 0x34d399;
const NAME_LABEL_OFFSET_X_PX = 4.5;

const STATUS_BUBBLE_Y_PX = -78;
const STATUS_FONT_SIZE_PX = 10;

const SPEECH_BASE_DURATION_MS = 4500;
const SPEECH_CHAR_DURATION_MS = 40;
const SPEECH_FADE_DURATION_MS = 350;
const SPEECH_Y_WITH_STATUS_PX = -106;
const SPEECH_Y_WITHOUT_STATUS_PX = -79;

const SEATED_FRAME_STRIDE = 3456;
const TALK_FRAME_DURATION_MS = 250;
const TALK_TICK_RATE_MS = 160;

/**
 * Starts the per-frame time budget (default 3 ms) for lazy avatar texture generation.
 * Prevents frame drops/stutter on CPU-bound devices by capping texture baking time per tick,
 * letting characters display their previous frame until the new texture finishes.
 */
export function beginTextureBudget(ms = DEFAULT_TEXTURE_BUDGET_MS) {
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

    // WHY: Shapes (shadow and nameplate tag) are baked into shared cached textures to eliminate per-avatar Graphics draw calls.
    const shadowBounds = SHADOW_BOUNDS;
    this.shadowKey = acquireShape(scene, 'shadow', shadowBounds, shapeRes, (g) => {
      g.fillStyle(0x000000, SHADOW_ALPHA);
      g.fillEllipse(0, 0, SHADOW_ELLIPSE_W, SHADOW_ELLIPSE_H, 20);
    });
    this.shadow = shapeImage(scene, this.shadowKey, shadowBounds, shapeRes);

    this.texScale = Math.min(MAX_TEX_SCALE, textResolution * TEX_SCALE_RATIO);
    this.code = encode(recipe);
    wear(this.code);
    this.figure = scene.add
      .image(0, 0, '__DEFAULT')
      .setOrigin(BOX.left / BOX.width, BOX.top / BOX.height)
      .setScale(1 / this.texScale)
      .setVisible(false);

    const label = scene.add
      .text(0, NAME_TAG_Y_PX, name, {
        fontFamily,
        fontSize: '11px',
        fontStyle: '600',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setResolution(textResolution);
    const tagW = label.width + NAME_TAG_PADDING_PX;
    const tagBounds = { x: -tagW / 2 - 1, y: NAME_TAG_BOUNDS_Y_PX, w: tagW + 2, h: NAME_TAG_BOUNDS_H_PX };
    this.tagKey = acquireShape(scene, `tag:${tagW.toFixed(2)}`, tagBounds, shapeRes, (g) => {
      rr(g, -tagW / 2, NAME_TAG_BG_Y_PX, tagW, NAME_TAG_BG_H_PX, NAME_TAG_BG_RADIUS_PX, NAME_TAG_BG_COLOR, NAME_TAG_BG_ALPHA);
      circle(g, -tagW / 2 + STATUS_DOT_OFFSET_X_PX, NAME_TAG_Y_PX, STATUS_DOT_RADIUS_PX, STATUS_DOT_COLOR);
    });
    const tag = shapeImage(scene, this.tagKey, tagBounds, shapeRes);
    label.setX(NAME_LABEL_OFFSET_X_PX);

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

  /** Toggles the avatar's seated state and hides/shows the floor shadow. */
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
    this.phase = moving ? (this.phase + deltaMs * WALK_PHASE_RATE) % (Math.PI * 2) : 0;
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
      this.status = new Bubble(this.scene, 0, STATUS_BUBBLE_Y_PX, text, {
        fontFamily: this.fontFamily,
        resolution: this.textResolution,
        tail: true,
        fontSize: STATUS_FONT_SIZE_PX,
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
    this.speechTimer = this.scene.time.delayedCall(SPEECH_BASE_DURATION_MS + shown.length * SPEECH_CHAR_DURATION_MS, () => {
      this.speechTween = this.scene.tweens.add({
        targets: bubble,
        alpha: 0,
        duration: SPEECH_FADE_DURATION_MS,
        onComplete: () => {
          if (this.speech === bubble) this.clearSpeech();
        },
      });
    });
  }

  private speechY() {
    // Above the status bubble (about 24 px tall) when there is one, else above the name tag.
    return this.status ? SPEECH_Y_WITH_STATUS_PX : SPEECH_Y_WITHOUT_STATUS_PX;
  }

  private clearSpeech() {
    this.speechTimer?.remove(false);
    this.speechTween?.stop();
    this.speechTimer = null;
    this.speechTween = null;
    this.speech?.destroy();
    this.speech = null;
  }

  /** Updates the avatar's character recipe and invalidates current frame textures. */
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

  /** Cleans up avatar game objects, timers, tweens, and releases cached textures. */
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

  /** Forces a redraw to immediately render the avatar texture. */
  show() {
    this.redraw(true);
  }

  /** Pre-bakes all 8 walking cycle frames across all 4 directions for this recipe to prevent first-walk lag. */
  prebake() {
    for (const dir of DIRECTIONS) {
      for (let step = 0; step <= WALK_FRAME_COUNT; step++) {
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
      SEATED_FRAME_STRIDE * Number(this._seated);
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
      time: talk ? (talk - 1) * TALK_FRAME_DURATION_MS : undefined,
    };
    return { frame, pose };
  }

  /** Recomputes current animation frame and updates sprite texture if changed. */
  redraw(force = false) {
    // Everything visible, packed in one number: step (0 standing, 1-8 walking),
    // blink, talking light, direction, mood, mug, headset.
    const step = !this._seated && this.moving ? 1 + (Math.round(this.phase / FRAME) % WALK_FRAME_COUNT) : 0;
    const blink = !this.moving && this.clock % BLINK_EVERY_MS < BLINK_MS ? 1 : 0;
    const talk = this.talking ? 1 + (Math.floor(this.clock / TALK_TICK_RATE_MS) % 2) : 0;
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
