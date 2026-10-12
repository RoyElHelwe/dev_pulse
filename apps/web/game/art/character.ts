/**
 * Procedural 3/4 view character sprite rendering.
 *
 * Draws customizable characters in layers (paper doll style: hair behind -> legs -> body -> arms -> head -> face -> hair front -> hat -> headset)
 * with consistent top-left lighting. Coordinates are design-tool pixel art in local pixels.
 */

import { flatRamp, type Ramp } from './color';
import { BLUSH, BOTTOM, CLOTH, EYES, GLOW, HAIR, SHOES, SKIN, type Swatch, TECH } from './palette';
import type { Pen } from './pen';
import type { Recipe } from './recipe';

/** Facing direction for character rendering. */
export type Direction = 'down' | 'up' | 'left' | 'right';

/** Facial expression and mood affecting eye and mouth art. */
export type Mood = 'neutral' | 'happy' | 'focus' | 'sleepy';

/** Per-frame animation pose, orientation, and interactive equipment states. */
export interface Pose {
  dir: Direction;
  /** Walk cycle angle (radians). */
  phase?: number;
  moving?: boolean;
  /** Sitting on a chair (does not walk). */
  seated?: boolean;
  /** Clock in ms, for blinking, breathing and steam. Leave out for a still picture. */
  time?: number;
  /** Eyes closed, when the caller keeps its own clock (the game). */
  blink?: boolean;
  mood?: Mood;
  /** In a call: headphones on (the light blinks while they talk). */
  headset?: boolean;
  talking?: boolean;
  /** Holding a mug (on a break). */
  mug?: boolean;
  /** Soft shadow on the floor. */
  shadow?: boolean;
  /** Old flat RGB shading, to compare with the hue-shifted ramps. */
  flat?: boolean;
}

const PI = Math.PI;

// Animation timing and physics constants
const BREATHE_PERIOD_MS = 650;
const BREATHE_SCALE = 0.35;
const WALK_BOB_SCALE = 1.5;
const BLINK_CYCLE_MS = 3700;
const BLINK_DURATION_MS = 120;
const TALK_MOUTH_CYCLE_MS = 90;
const TALK_LED_CYCLE_MS = 160;
const STEAM_CYCLE_MS = 1400;

// Visual alpha and layout offsets
const SHADOW_COLOR = 0x000000;
const HIGHLIGHT_COLOR = 0xffffff;
const SHADOW_ALPHA = 0.16;
const SEAT_Y_OFFSET_PX = 7;
// Seated: the figure is lowered 7px; feet rest on the floor (a little lower on screen from the front, as they are closer to us).
const SEAT_FOOT = 0;
const SEAT_FOOT_SIDE = 0;

type HairView = 'down' | 'up' | 'side';

interface CharacterColors {
  skin: Ramp;
  hair: Ramp;
  top: Ramp;
  trim: Ramp;
  bottom: Ramp;
  shoes: Ramp;
  hat: Ramp;
  tech: Ramp;
}

/** Shared per-frame state passed through character drawing helpers. */
interface CharacterContext {
  pen: Pen;
  recipe: Recipe;
  pose: Pose;
  c: CharacterColors;
  dir: Direction;
  side: boolean;
  time: number;
  isMoving: boolean;
  phase: number;
  swing: number;
  bob: number;
  build: number;
  lx: number;
  bw: number;
  half: number;
  legW: number;
  legTop: number;
  ty: number;
  hy: number;
}

function createCharacterContext(pen: Pen, recipe: Recipe, pose: Pose): CharacterContext {
  const tone = (s: Swatch): Ramp => (pose.flat ? flatRamp(s.ramp.base) : s.ramp);
  const c: CharacterColors = {
    skin: tone(SKIN[recipe.skin]),
    hair: tone(HAIR[recipe.hairColor]),
    top: tone(CLOTH[recipe.topColor]),
    trim: tone(CLOTH[recipe.trimColor]),
    bottom: tone(BOTTOM[recipe.bottomColor]),
    shoes: tone(SHOES[recipe.shoes]),
    hat: tone(CLOTH[recipe.hatColor]),
    tech: TECH.body.ramp,
  };

  const dir = pose.dir;
  const side = dir === 'left' || dir === 'right';
  const time = pose.time ?? 0;
  const isMoving = !pose.seated && Boolean(pose.moving);
  const phase = isMoving ? (pose.phase ?? 0) : 0;
  const swing = Math.sin(phase);
  const breathe = pose.time === undefined ? 0 : Math.sin(time / BREATHE_PERIOD_MS) * BREATHE_SCALE;
  const bob = isMoving ? Math.abs(Math.cos(phase)) * WALK_BOB_SCALE : breathe;

  const build = recipe.build === 'slim' ? 0 : recipe.build === 'regular' ? 1 : 2;
  const lx = recipe.height * 1.6;
  const bw = 17 + build * 3;
  const half = bw / 2;
  const legW = 5.5 + build * 0.5;
  const legTop = -14 - lx;
  const ty = -30 - lx - bob;
  const hy = ty - 9;

  return {
    pen,
    recipe,
    pose,
    c,
    dir,
    side,
    time,
    isMoving,
    phase,
    swing,
    bob,
    build,
    lx,
    bw,
    half,
    legW,
    legTop,
    ty,
    hy,
  };
}

// Shapes lit from the top left: shadow tone, base tone nudged up-left.
function drawBlob(ctx: CharacterContext, x: number, y: number, w: number, h: number, r: number, k: Ramp): void {
  ctx.pen.rect(x, y, w, h, r, k.shadow);
  ctx.pen.rect(x, y, w - 1.4, h - 1.5, r, k.base);
}

function drawBall(ctx: CharacterContext, x: number, y: number, r: number, k: Ramp): void {
  ctx.pen.circle(x, y, r, k.shadow);
  ctx.pen.circle(x - 0.5, y - 0.6, r - 0.8, k.base);
}

function drawLeg(ctx: CharacterContext, x: number, y: number, w: number, h: number, shaded: boolean): void {
  const cloth = shaded ? ctx.c.bottom.shadow : ctx.c.bottom.base;
  const skin = shaded ? ctx.c.skin.shadow : ctx.c.skin.base;
  if (ctx.recipe.bottom === 'trousers') ctx.pen.rect(x, y, w, h, 3, cloth);
  else {
    ctx.pen.rect(x + 0.4, y, w - 0.8, h, 3, skin);
    if (ctx.recipe.bottom === 'shorts') ctx.pen.rect(x - 0.3, y - 0.5, w + 0.6, 6.5, 2.5, cloth);
  }
}

function drawSleeve(ctx: CharacterContext, x: number, y: number, w: number, back: boolean): void {
  const k = back ? { base: ctx.c.top.deep, shadow: ctx.c.top.deep } : { base: ctx.c.top.shadow, shadow: ctx.c.top.deep };
  if (ctx.recipe.top === 'tee') {
    ctx.pen.rect(x + 0.3, y + 4, w - 0.6, 9.5, 2.5, back ? ctx.c.skin.shadow : ctx.c.skin.base);
    ctx.pen.rect(x - 0.3, y, w + 0.6, 6.5, 2.5, k.base);
    return;
  }
  ctx.pen.rect(x, y, w, 13, 2.5, k.base);
  if (ctx.recipe.top === 'sweater' || ctx.recipe.top === 'hoodie') ctx.pen.rect(x, y + 10.8, w, 2.2, 1, k.shadow);
  if (ctx.recipe.top === 'blazer' || ctx.recipe.top === 'shirt') ctx.pen.rect(x + 0.2, y + 11.2, w - 0.4, 1.8, 0.8, ctx.c.trim.light, 0.9);
}

function drawPattern(ctx: CharacterContext, x: number, w: number, front: boolean): void {
  if (ctx.recipe.pattern === 'stripes') {
    for (let yy = ctx.ty + 4; yy < ctx.ty + 16; yy += 4) ctx.pen.rect(x + 1.3, yy, w - 2.8, 1.6, 0.5, ctx.c.trim.base, 0.95);
  } else if (ctx.recipe.pattern === 'logo' && front && ctx.recipe.top !== 'blazer') {
    const lx2 = x + w * 0.3;
    ctx.pen.poly([lx2, ctx.ty + 4.5, lx2 + 2.2, ctx.ty + 6.7, lx2, ctx.ty + 8.9, lx2 - 2.2, ctx.ty + 6.7], ctx.c.trim.base);
  }
}

function drawFrontDetails(ctx: CharacterContext): void {
  const { pen, recipe, ty, half, bw, c } = ctx;
  switch (recipe.top) {
    case 'hoodie':
      pen.rect(-half + 4, ty + 9, bw - 8, 5, 2, c.top.shadow);
      pen.line(-2.2, ty + 1.5, -2.6, ty + 7.5, 0.8, c.trim.light);
      pen.line(2.2, ty + 1.5, 2.6, ty + 7.5, 0.8, c.trim.light);
      break;
    case 'shirt':
      pen.poly([-4.8, ty - 0.6, -0.4, ty - 0.6, -1.6, ty + 3.4], c.trim.light);
      pen.poly([4.8, ty - 0.6, 0.4, ty - 0.6, 1.6, ty + 3.4], c.trim.light);
      for (const by of [5.5, 9.5, 13.5]) pen.circle(0, ty + by, 0.65, c.top.deep);
      break;
    case 'sweater':
      pen.ellipse(0, ty + 0.6, 10, 3.8, c.top.shadow);
      pen.rect(-half, ty + 14.5, bw, 3.5, 2, c.top.shadow);
      break;
    case 'blazer':
      pen.poly([-3.8, ty - 0.3, 3.8, ty - 0.3, 0, ty + 10], c.trim.light);
      pen.line(-3.8, ty, 0, ty + 10, 1.3, c.top.deep);
      pen.line(3.8, ty, 0, ty + 10, 1.3, c.top.deep);
      pen.circle(0, ty + 12, 0.8, c.top.deep);
      break;
    case 'tee':
      pen.pie(0, ty - 0.5, 3.4, 0, PI, c.skin.shadow);
      break;
  }
}

function drawMug(ctx: CharacterContext, x: number, y: number): void {
  ctx.pen.rect(x - 1, y, 5, 6, 1.3, ctx.c.trim.shadow);
  ctx.pen.rect(x - 1, y, 4.3, 5.3, 1.3, ctx.c.trim.base);
  ctx.pen.ring(x + 4.3, y + 3, 1.4, 1, ctx.c.trim.shadow);
  if (ctx.pose.time !== undefined) {
    for (let i = 0; i < 2; i++) {
      const t = ((ctx.time / STEAM_CYCLE_MS + i * 0.5) % 1 + 1) % 1;
      ctx.pen.circle(x + 1.3 + Math.sin(t * 6 + i) * 1.2, y - 2 - t * 8, 1.2 + t * 0.8, HIGHLIGHT_COLOR, 0.5 * (1 - t));
    }
  }
}

/** Seated, from the front: the thighs come toward us over the hem of the body, knees at the bottom. */
function seatedThighs(ctx: CharacterContext): void {
  const { pen, recipe, legW, legTop, half, c } = ctx;
  const cloth = recipe.bottom === 'trousers' || recipe.bottom === 'shorts' ? c.bottom : c.skin;
  for (const s of [-1, 1]) {
    const x = s < 0 ? -legW - 1.5 : 1.5;
    drawBlob(ctx, x - 0.2, legTop + 0.3, legW + 0.4, 6.2, 3, cloth);
    pen.rect(x + 0.8, legTop + 5.3, legW - 1.8, 0.9, 0.4, cloth.light, 0.6);
  }
  if (recipe.bottom === 'skirt') {
    const y = legTop + 0.2;
    pen.poly([-half + 1.5, y, half - 1.5, y, half + 0.5, y + 6.8, -half - 0.5, y + 6.8], c.bottom.shadow);
    pen.poly([-half + 1.5, y, half - 2, y, half - 0.5, y + 6, -half - 0.5, y + 6], c.bottom.base);
  }
}

/** Seated, side view: thigh forward from the hip, knee bent, shin straight down, foot flat on the floor. */
function seatedSideLeg(ctx: CharacterContext, far: boolean, sh: number): void {
  const { pen, recipe, legTop, legW, c } = ctx;
  const dx = far ? 2 : 0;
  const bk = far ? { ...c.bottom, base: c.bottom.shadow, shadow: c.bottom.deep } : c.bottom;
  const sk = far ? { ...c.skin, base: c.skin.shadow, shadow: c.skin.deep } : c.skin;
  const shoe = far ? { ...c.shoes, base: c.shoes.shadow, shadow: c.shoes.deep } : c.shoes;
  const hipX = -sh + 1;
  const kneeX = sh + 3 + dx;
  const top = legTop + 0.4;
  const th = legW + 0.2;
  const cloth = recipe.bottom === 'trousers' ? bk : sk;
  const shinX = kneeX - legW + 0.6;
  drawBlob(ctx, shinX, top + 2, legW - 0.6, SEAT_FOOT_SIDE - 3 - top - 2, 2, cloth);
  drawBlob(ctx, hipX, top, kneeX - hipX, th, 2.8, cloth);
  if (recipe.bottom === 'shorts') drawBlob(ctx, hipX - 0.3, top - 0.3, (kneeX - hipX) * 0.68, th + 0.8, 2.5, bk);
  pen.rect(shinX - 0.4, SEAT_FOOT_SIDE - 4, legW + 3.4, 4, 2, shoe.shadow);
  pen.rect(shinX - 0.4, SEAT_FOOT_SIDE - 4, legW + 2.6, 3.2, 2, shoe.base);
  if (recipe.bottom === 'skirt' && !far) {
    pen.poly([hipX - 3, top - 3, sh, top - 3, kneeX - 1, top + 0.5, kneeX - 1, top + th - 0.5, hipX - 3, top + th + 1.2], c.bottom.shadow);
    pen.poly([hipX - 3, top - 3, sh - 0.5, top - 3, kneeX - 1.8, top + 0.2, kneeX - 1.8, top + th - 1.4, hipX - 3, top + th - 0.2], c.bottom.base);
  }
}

function drawEye(ctx: CharacterContext, x: number, y: number, mood: Mood, blink: boolean): void {
  const pen = ctx.pen;
  if (mood === 'happy') pen.arc(x, y + 0.7, 1.4, PI + 0.35, 2 * PI - 0.35, 1.1, EYES);
  else if (mood === 'sleepy' || blink) pen.rect(x - 1.3, y + 0.3, 2.6, 0.8, 0.4, EYES);
  else {
    pen.circle(x, y, 1.3, EYES);
    pen.circle(x - 0.45, y - 0.45, 0.4, HIGHLIGHT_COLOR, 0.8);
  }
}

function drawMouth(ctx: CharacterContext, x: number, y: number, mood: Mood): void {
  const { pen, pose, time } = ctx;
  if (mood === 'happy' || pose.talking) {
    const open = pose.talking ? 0.9 + Math.abs(Math.sin(time / TALK_MOUTH_CYCLE_MS)) * 0.9 : 0;
    if (open) pen.ellipse(x, y + 0.4, 2.6, open + 0.6, EYES, 0.75);
    else pen.arc(x, y - 1.2, 1.9, 0.5, PI - 0.5, 0.9, EYES, 0.8);
  } else if (mood === 'sleepy') pen.circle(x + 0.4, y + 0.6, 0.8, EYES, 0.55);
  else if (mood === 'focus') pen.rect(x - 1.1, y + 0.4, 2.2, 0.7, 0.3, EYES, 0.6);
}

function drawBeard(ctx: CharacterContext, view: 'down' | 'side'): void {
  const { pen, recipe, hy, c } = ctx;
  const k = c.hair;
  if (recipe.beard === 'none') return;
  if (view === 'down') {
    if (recipe.beard === 'stubble') pen.pie(0, hy + 0.8, 9.2, 0.15, PI - 0.15, k.base, 0.3);
    if (recipe.beard === 'full') {
      pen.pie(0, hy + 1, 9.6, -0.05, PI + 0.05, k.shadow);
      pen.pie(-0.4, hy + 0.6, 9, 0, PI, k.base);
      pen.rect(-2, hy + 5, 4, 1.1, 0.5, c.skin.deep, 0.8);
    }
    if (recipe.beard === 'moustache' || recipe.beard === 'full') pen.rect(-3.3, hy + 3.9, 6.6, 1.9, 0.9, k.base);
  } else {
    if (recipe.beard === 'stubble') pen.pie(0, hy + 0.8, 9.2, -0.1, PI * 0.6, k.base, 0.3);
    if (recipe.beard === 'full') pen.pie(0, hy + 0.8, 9.6, -0.15, PI * 0.62, k.base);
    if (recipe.beard === 'moustache' || recipe.beard === 'full') pen.rect(5.6, hy + 3.7, 4, 1.8, 0.9, k.base);
  }
}

function drawGlasses(ctx: CharacterContext, view: 'down' | 'side'): void {
  const { pen, recipe, hy, c } = ctx;
  const frame = c.tech.base;
  const g = recipe.glasses;
  if (g === 'none') return;
  if (view === 'down') {
    for (const s of [-1, 1]) {
      const x = s * 3.5;
      if (g === 'round') pen.ring(x, hy + 1.8, 2.7, 0.9, frame);
      if (g === 'square') pen.frame(x - 2.8, hy - 0.5, 5.6, 4.5, 1.2, 0.9, frame);
      if (g === 'shades') {
        pen.rect(x - 3, hy - 0.4, 6, 4.2, 1.6, frame);
        pen.line(x - 1.6, hy + 0.6, x - 0.4, hy + 0.6, 0.7, HIGHLIGHT_COLOR, 0.5);
      }
    }
    pen.line(-0.8, hy + 1.4, 0.8, hy + 1.4, 0.9, frame);
  } else {
    if (g === 'shades') pen.rect(3.6, hy - 0.3, 4.4, 3.9, 1.4, frame);
    else pen.frame(3.6, hy - 0.2, 4.2, 3.8, g === 'round' ? 1.9 : 0.9, 0.9, frame);
    pen.line(3.6, hy + 1.2, -1.5, hy + 0.8, 0.9, frame);
  }
}

function drawFace(ctx: CharacterContext): void {
  const { pen, pose, recipe, hy, time, c } = ctx;
  const mood = pose.mood ?? 'neutral';
  const blink = pose.blink ?? (pose.time !== undefined && time % BLINK_CYCLE_MS < BLINK_DURATION_MS);
  pen.circle(-5.6, hy + 4.4, 1.8, BLUSH, 0.3);
  pen.circle(5.6, hy + 4.4, 1.8, BLUSH, 0.3);
  if (recipe.freckles) {
    for (const s of [-1, 1]) {
      for (const [fx, fy] of [[4.3, 3.2], [5.8, 2.6], [6.6, 3.9]]) {
        pen.circle(s * fx, hy + fy, 0.42, c.skin.deep, 0.75);
      }
    }
  }
  drawBeard(ctx, 'down');
  for (const s of [-1, 1]) drawEye(ctx, s * 3.4, hy + 1.8, mood, blink);
  if (mood === 'focus') {
    for (const s of [-1, 1]) pen.rect(s * 3.4 - 1.7, hy - 1.4, 3.4, 0.85, 0.4, c.hair.deep);
  }
  drawMouth(ctx, 0, hy + 4.6, mood);
  drawGlasses(ctx, 'down');
}

function drawHairChain(pen: Pen, k: Ramp, x: number, from: number, to: number, r: number): void {
  for (let y = from, i = 0; y <= to; y += r * 1.25, i++) {
    pen.circle(x, y, r, i % 2 ? k.shadow : k.base);
  }
}

function drawHairSheen(pen: Pen, k: Ramp, x: number, y: number, w: number): void {
  pen.rect(x, y, w, 1.5, 0.7, k.light, 0.75);
}

function drawHairBehind(ctx: CharacterContext, view: HairView): void {
  const k = ctx.c.hair;
  const style = ctx.recipe.hair;
  const hy = ctx.hy;
  const sway = ctx.isMoving ? ctx.swing * 1.5 : 0;

  if (view === 'down') {
    if (style === 'long') ctx.pen.rect(-11, hy - 2, 22, 17, 6, k.shadow);
    if (style === 'bob') ctx.pen.rect(-11.4, hy - 4, 22.8, 13, 5, k.shadow);
    if (style === 'bun') drawBall(ctx, 0, hy - 10.5, 4.8, k);
    if (style === 'ponytail') ctx.pen.rect(7.5 + sway * 0.4, hy - 1, 4.5, 11, 2.2, k.shadow);
    if (style === 'afro') drawBall(ctx, 0, hy - 3, 13.6, k);
    if (style === 'braids') {
      for (const s of [-1, 1]) drawHairChain(ctx.pen, k, s * 10.2, hy + 1, hy + 15, 2.1);
    }
  } else if (view === 'side') {
    // Side, facing right: the back of the head is on the left.
    if (style === 'long') ctx.pen.rect(-14, hy - 2, 10, 16, 5, k.shadow);
    if (style === 'bob') ctx.pen.rect(-12.5, hy - 3.5, 11.5, 11.5, 5, k.shadow);
    if (style === 'bun') drawBall(ctx, -6.5, hy - 8.5, 4.8, k);
    if (style === 'ponytail') {
      ctx.pen.rect(-14 - sway, hy - 3, 5, 13, 2.5, k.shadow);
      ctx.pen.rect(-13.5, hy - 3, 4.4, 1.8, 0.8, ctx.c.trim.base);
    }
    if (style === 'afro') drawBall(ctx, -2, hy - 3, 13.6, k);
    if (style === 'braids') drawHairChain(ctx.pen, k, -9.5 - sway * 0.3, hy + 1, hy + 15, 2.1);
  }
}

function drawHairFrontDownCapped(ctx: CharacterContext, style: string): void {
  const { pen, hy, c } = ctx;
  const k = c.hair;
  pen.pie(0, hy, 10, PI, 2 * PI, k.base);
  if (style === 'short') {
    pen.rect(-9.8, hy - 3.5, 19.6, 4.5, 2, k.base);
    drawHairSheen(pen, k, -6, hy - 8.4, 5);
  } else if (style === 'sidepart') {
    pen.poly([-9.8, hy - 0.5, -9.8, hy - 6, 3, hy - 9.6, 9.8, hy - 4, 9.8, hy - 1, 3, hy - 4.6], k.base);
    pen.line(-3.6, hy - 9.2, -2.6, hy - 6, 0.8, k.light);
  } else if (style === 'long' || style === 'bob') {
    pen.rect(-9.8, hy - 4.4, 19.6, style === 'bob' ? 5 : 4.5, style === 'bob' ? 1.5 : 2, k.base);
    pen.rect(-9.9, hy - 3, 3.8, style === 'bob' ? 9 : 11, 1.8, k.base);
    pen.rect(6.1, hy - 3, 3.8, style === 'bob' ? 9 : 11, 1.8, k.base);
    drawHairSheen(pen, k, -6, hy - 8.4, 5);
  } else if (style === 'bun' || style === 'ponytail') {
    pen.poly([-9.8, hy - 0.5, -9.8, hy - 5, 0, hy - 8.5, 9.8, hy - 5, 9.8, hy - 1, 2, hy - 3.8], k.base);
    drawHairSheen(pen, k, -6, hy - 8.4, 5);
  } else if (style === 'curly') {
    pen.rect(-9.8, hy - 3.5, 19.6, 4.5, 2, k.base);
    for (let i = 0; i < 7; i++) {
      const a = PI + (i / 6) * PI;
      drawBall(ctx, Math.cos(a) * 9.5, hy + Math.sin(a) * 9.5, 3.4, k);
    }
  } else if (style === 'afro') {
    for (let x = -7; x <= 7; x += 3.5) drawBall(ctx, x, hy - 6.5, 3.3, k);
  } else if (style === 'braids') {
    pen.rect(-9.8, hy - 3.6, 8.9, 4.4, 2, k.base);
    pen.rect(0.9, hy - 3.6, 8.9, 4.4, 2, k.base);
    pen.line(0, hy - 9.6, 0, hy - 4.5, 0.8, k.deep);
  }
}

function drawHairFrontDown(ctx: CharacterContext): void {
  const { pen, hy, c } = ctx;
  const k = c.hair;
  const style = ctx.recipe.hair;

  switch (style) {
    case 'buzz':
      pen.pie(0, hy, 9.8, PI + 0.1, 2 * PI - 0.1, k.base, 0.75);
      pen.rect(-8.6, hy - 3.4, 17.2, 1.4, 0.7, k.base, 0.75);
      break;
    case 'mohawk':
      pen.pie(0, hy, 9.8, PI + 0.2, 2 * PI - 0.2, k.base, 0.3);
      drawBlob(ctx, -2.4, hy - 15.5, 4.8, 10, 2.4, k);
      break;
    case 'bald':
      pen.circle(-3.4, hy - 5.4, 2.2, c.skin.light, 0.55);
      break;
    default:
      drawHairFrontDownCapped(ctx, style);
      break;
  }
}

function drawHairFrontUp(ctx: CharacterContext): void {
  const { pen, hy, c } = ctx;
  const k = c.hair;
  const style = ctx.recipe.hair;
  const sway = ctx.isMoving ? ctx.swing * 1.5 : 0;

  if (style === 'bald') {
    pen.circle(-3.4, hy - 5, 2.2, c.skin.light, 0.5);
    return;
  }
  if (style === 'mohawk') {
    pen.circle(0, hy, 9.8, k.base, 0.3);
    drawBlob(ctx, -2.4, hy - 15, 4.8, 23, 2.4, k);
    return;
  }
  if (style === 'afro') {
    drawBall(ctx, 0, hy - 3, 13.6, k);
    return;
  }
  pen.circle(0, hy - 0.5, 10, k.base, style === 'buzz' ? 0.75 : 1);
  if (style === 'long') pen.rect(-10, hy, 20, 16, 6, k.base);
  if (style === 'bob') pen.rect(-10.6, hy - 1, 21.2, 10, 5, k.base);
  if (style === 'bun') drawBall(ctx, 0, hy - 7.5, 5, k);
  if (style === 'ponytail') {
    pen.rect(-2.3 + sway * 0.5, hy + 3, 4.6, 14, 2.3, k.shadow);
    pen.rect(-2.7, hy + 3, 5.4, 1.8, 0.8, k.deep);
  }
  if (style === 'curly') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 2 * PI;
      drawBall(ctx, Math.cos(a) * 9, hy - 0.5 + Math.sin(a) * 9, 3.2, k);
    }
  }
  if (style === 'braids') {
    for (const s of [-1, 1]) drawHairChain(pen, k, s * 3.6, hy + 4, hy + 18, 2.1);
  }
  if (style !== 'buzz') drawHairSheen(pen, k, -5, hy - 8, 6);
}

function drawHairFrontSide(ctx: CharacterContext): void {
  const { pen, hy, c } = ctx;
  const k = c.hair;
  const style = ctx.recipe.hair;

  if (style === 'bald') {
    pen.circle(-2.5, hy - 5.4, 2.2, c.skin.light, 0.55);
    return;
  }
  if (style === 'mohawk') {
    pen.pie(0, hy, 9.8, PI, 2 * PI, k.base, 0.3);
    for (let a = PI * 1.08; a <= PI * 1.75; a += 0.16) {
      drawBall(ctx, Math.cos(a) * 10.2, hy + Math.sin(a) * 10.2, 2.6, k);
    }
    return;
  }
  const alpha = style === 'buzz' ? 0.75 : 1;
  pen.pie(0, hy, 10, PI, 2 * PI, k.base, alpha);
  pen.circle(-3.8, hy - 1.5, 7.8, k.base, alpha);
  if (style === 'buzz') return;
  pen.rect(-1, hy - 3.5, 10, 3, 1.5, k.base);
  if (style === 'sidepart') pen.rect(-2, hy - 7, 12.5, 4, 2, k.base);
  if (style === 'long' || style === 'bob') pen.rect(-10, hy - 2, 6.5, style === 'long' ? 12 : 9, 3, k.base);
  if (style === 'curly') {
    for (let i = 0; i < 6; i++) {
      const a = PI * 0.6 + (i / 5) * PI * 1.3;
      drawBall(ctx, -1 + Math.cos(a) * 9.4, hy + Math.sin(a) * 9.4, 3.2, k);
    }
  }
  if (style === 'afro') drawBall(ctx, 4.5, hy - 6.5, 3.3, k);
  drawHairSheen(pen, k, -4, hy - 8.4, 6);
}

function hairPass(ctx: CharacterContext, view: HairView, pass: 'behind' | 'front'): void {
  if (pass === 'behind') {
    drawHairBehind(ctx, view);
    return;
  }
  if (view === 'down') drawHairFrontDown(ctx);
  else if (view === 'up') drawHairFrontUp(ctx);
  else drawHairFrontSide(ctx);
}

function drawHat(ctx: CharacterContext, view: HairView): void {
  const { pen, recipe, hy, c } = ctx;
  const k = c.hat;
  if (recipe.hat === 'beanie') {
    pen.pie(0, hy - 1, 10.8, PI, 2 * PI, k.base);
    pen.pie(-0.5, hy - 1.6, 9.8, PI + 0.3, 1.5 * PI, k.light, 0.35);
    pen.rect(-11, hy - 3.6, 22, 4.6, 2, k.shadow);
    for (let x = -9; x <= 9; x += 3) pen.line(x, hy - 3, x, hy + 0.4, 0.7, k.deep, 0.5);
    drawBall(ctx, view === 'side' ? -1.5 : 0, hy - 12, 2.8, c.trim);
  } else if (recipe.hat === 'cap') {
    pen.pie(0, hy - 1.5, 10.4, PI, 2 * PI, k.base);
    pen.pie(-0.5, hy - 2, 9.4, PI + 0.3, 1.5 * PI, k.light, 0.35);
    if (view === 'down') pen.ellipse(0, hy - 2.6, 20, 5.5, k.shadow);
    if (view === 'up') pen.rect(-3, hy - 3, 6, 2, 1, k.deep);
    if (view === 'side') pen.rect(5, hy - 3.8, 9.5, 2.8, 1.4, k.shadow);
    pen.circle(0, hy - 11.6, 1.2, k.deep);
  }
}

function drawHeadset(ctx: CharacterContext, view: HairView): void {
  const { pen, pose, hy, time, c } = ctx;
  if (!pose.headset) return;
  const k = c.tech;
  const accent = c.trim.base;
  const led = pose.talking ? 0.45 + 0.55 * Math.abs(Math.sin(time / TALK_LED_CYCLE_MS)) : 0;
  if (view === 'side') {
    pen.arc(-1, hy, 11, PI * 1.12, PI * 1.9, 2, k.base);
    drawBlob(ctx, -4.2, hy - 2.6, 5.8, 8.4, 2.4, k);
    pen.ring(-1.3, hy + 1.6, 1.9, 0.8, accent);
    pen.line(0.5, hy + 4.6, 7, hy + 6, 1.1, k.base);
    pen.circle(7.6, hy + 6, 1.4, k.shadow);
    if (led) pen.circle(-1.3, hy + 1.6, 0.9, GLOW.led, led);
    return;
  }
  pen.arc(0, hy - 0.6, 11.3, PI + 0.12, 2 * PI - 0.12, 2, k.base);
  for (const s of [-1, 1]) {
    drawBlob(ctx, s < 0 ? -12.8 : 8.8, hy - 2, 4.2, 7.8, 1.8, k);
    pen.rect(s < 0 ? -12.2 : 11.4, hy - 0.4, 1, 4.6, 0.5, accent);
  }
  if (view === 'down') {
    pen.line(-10.8, hy + 4.6, -4.6, hy + 6.6, 1.1, k.base);
    pen.circle(-4, hy + 6.7, 1.4, k.shadow);
  }
  if (led) pen.circle(-10.8, hy - 1, 0.9, GLOW.led, led);
}

function drawFrontOrBackLegs(ctx: CharacterContext, front: boolean, lift: number): void {
  const { pen, pose, recipe, legW, legTop, lx, half, c } = ctx;
  // Legs, then shoes.
  if (pose.seated) {
    // Seen from the front the shins and shoes go behind the body; the thighs
    // (toward the camera) are drawn over its hem, see seatedThighs(). From
    // behind only the back of the thighs shows under the body.
    for (const s of [-1, 1]) {
      const x = s < 0 ? -legW - 1.5 : 1.5;
      if (front) {
        const top = legTop + 4.5;
        const shin = recipe.bottom === 'trousers' ? c.bottom : c.skin;
        drawBlob(ctx, x + 0.6, top, legW - 1.2, SEAT_FOOT - 3 - top, 2, { ...shin, base: shin.shadow, shadow: shin.deep });
        pen.rect(x - 0.7, SEAT_FOOT - 4, legW + 1.6, 4.2, 2, c.shoes.shadow);
        pen.rect(x - 0.7, SEAT_FOOT - 4, legW + 0.8, 3.4, 2, c.shoes.base);
      } else drawLeg(ctx, x, legTop, legW, 5, s > 0);
    }
  } else {
    for (const s of [-1, 1]) {
      const x = s < 0 ? -legW - 1 : 1;
      const dy = s < 0 ? -lift : lift;
      drawLeg(ctx, x, legTop + dy, legW, 12 + lx, s > 0);
      pen.rect(x - 0.5, -4 + dy, legW + 1, 4, 2, c.shoes.shadow);
      pen.rect(x - 0.5, -4 + dy, legW, 3.2, 2, c.shoes.base);
    }
  }
  if (recipe.bottom === 'skirt' && !(pose.seated && front)) {
    pen.poly([-half + 1, legTop - 3, half - 1, legTop - 3, half + 1.5, legTop + 8, -half - 1.5, legTop + 8], c.bottom.shadow);
    pen.poly([-half + 1, legTop - 3, half - 2, legTop - 3, half, legTop + 7, -half - 1.5, legTop + 7], c.bottom.base);
  }
}

function drawFrontOrBackTorso(ctx: CharacterContext, front: boolean): void {
  const { pen, recipe, half, ty, bw, pose, c } = ctx;
  // Body.
  drawBlob(ctx, -half, ty, bw, 18, 7, c.top);
  pen.rect(-half, ty + 13, bw, 3, 1, c.top.deep, 0.25);
  pen.rect(-half + 4, ty + 1.2, bw * 0.35, 1.3, 0.6, c.top.light, 0.7);
  drawPattern(ctx, -half, bw, front);
  if (front) drawFrontDetails(ctx);
  else if (recipe.top === 'hoodie') drawBlob(ctx, -6, ty - 1, 12, 8, 4, { ...c.top, base: c.top.shadow, shadow: c.top.deep });
  if (pose.seated && front) seatedThighs(ctx);
}

function drawFrontOrBackArms(ctx: CharacterContext, front: boolean): void {
  const { pen, pose, half, build, isMoving, swing, ty, c } = ctx;
  // Arms and hands; the right hand may hold a mug.
  const arm = isMoving ? swing * 2 : 0;
  const armW = 5 + build * 0.3;
  for (const s of [-1, 1]) {
    const x = s < 0 ? -half - armW + 1 : half - 1;
    const ay = ty + 2 + (s < 0 ? arm : -arm);
    drawSleeve(ctx, x, ay, armW, false);
    const hx = x + armW / 2;
    pen.circle(hx, ay + 13.6, 2.6, c.skin.base);
    if (pose.mug && s > 0 && front) drawMug(ctx, hx + 0.5, ay + 12.5);
  }
}

function drawFrontOrBackHead(ctx: CharacterContext, front: boolean): void {
  const { pen, hy, ty, c } = ctx;
  const view: HairView = front ? 'down' : 'up';
  // Head.
  if (front) {
    pen.circle(-9.3, hy + 1.6, 2, c.skin.shadow);
    pen.circle(9.3, hy + 1.6, 2, c.skin.shadow);
    pen.rect(-3, ty - 2.5, 6, 4.5, 2, c.skin.shadow);
  }
  drawBall(ctx, 0, hy, 9.5, c.skin);
  if (front) drawFace(ctx);
  hairPass(ctx, view, 'front');
  drawHat(ctx, view);
  drawHeadset(ctx, view);
}

function drawFrontOrBack(ctx: CharacterContext, front: boolean): void {
  const lift = ctx.isMoving ? ctx.swing * 1.8 : 0;

  hairPass(ctx, front ? 'down' : 'up', 'behind');
  if (front && ctx.recipe.top === 'hoodie') ctx.pen.ellipse(0, ctx.ty + 0.5, ctx.bw - 3, 8, ctx.c.top.deep);

  drawFrontOrBackLegs(ctx, front, lift);
  drawFrontOrBackTorso(ctx, front);
  drawFrontOrBackArms(ctx, front);
  drawFrontOrBackHead(ctx, front);
}

function drawSideLegs(ctx: CharacterContext, sh: number): void {
  const { pen, pose, recipe, swing, legW, legTop, lx, c } = ctx;
  if (pose.seated) {
    seatedSideLeg(ctx, true, sh);
    seatedSideLeg(ctx, false, sh);
  } else {
    const back = -swing * 3.5;
    const fore = swing * 3.5;
    drawLeg(ctx, back - legW / 2, legTop, legW, 12 + lx, true);
    pen.rect(back - legW / 2 + 1, -4, legW + 1, 4, 2, c.shoes.shadow);
    drawLeg(ctx, fore - legW / 2, legTop, legW, 12 + lx, false);
    pen.rect(fore - legW / 2 + 1, -4, legW + 1, 4, 2, c.shoes.base);
    if (recipe.bottom === 'skirt') {
      pen.poly([-sh + 1, legTop - 3, sh - 1, legTop - 3, sh + 2.5, legTop + 8, -sh - 2.5, legTop + 8], c.bottom.base);
      pen.poly([-sh - 2.5, legTop + 6.5, sh + 2.5, legTop + 6.5, sh + 2.5, legTop + 8, -sh - 2.5, legTop + 8], c.bottom.shadow);
    }
  }
}

function drawSideFarArm(ctx: CharacterContext): void {
  // The far arm swings behind the body.
  const armW = 5 + ctx.build * 0.3;
  const backArm = -ctx.swing * 4;
  drawSleeve(ctx, backArm - armW / 2, ctx.ty + 3, armW, true);
  ctx.pen.circle(backArm, ctx.ty + 16.5, 2.5, ctx.c.skin.shadow);
}

function drawSideTorso(ctx: CharacterContext, sw: number, sh: number): void {
  const { pen, recipe, ty, c } = ctx;
  if (recipe.top === 'hoodie') pen.rect(-sh - 1.8, ty - 1.5, 7, 9, 3.5, c.top.shadow);
  drawBlob(ctx, -sh, ty, sw, 18, 6, c.top);
  pen.rect(-sh, ty + 2, 3.5, 14, 1.7, c.top.shadow, 0.7);
  drawPattern(ctx, -sh, sw, false);
  if (recipe.top === 'shirt') pen.poly([1.5, ty - 0.6, 5.5, ty - 0.6, 3.6, ty + 3.4], c.trim.light);
  if (recipe.top === 'blazer') {
    pen.rect(sh - 4, ty + 0.4, 3.4, 9, 1.5, c.trim.light);
    pen.line(sh - 4, ty + 0.4, sh - 2, ty + 9.5, 1.2, c.top.deep);
  }
  if (recipe.top === 'sweater') pen.rect(-sh, ty + 14.5, sw, 3.5, 2, c.top.shadow);
}

function drawSideNearArm(ctx: CharacterContext): void {
  const armW = 5 + ctx.build * 0.3;
  const foreArm = ctx.swing * 4;
  drawSleeve(ctx, foreArm - armW / 2, ctx.ty + 3, armW, false);
  ctx.pen.circle(foreArm, ctx.ty + 16.5, 2.6, ctx.c.skin.base);
  if (ctx.pose.mug) drawMug(ctx, foreArm + 1, ctx.ty + 13);
}

function drawSideHead(ctx: CharacterContext): void {
  const { pen, pose, recipe, hy, ty, time, c } = ctx;
  // Head in profile: nose and ear, face on the right.
  pen.rect(-1.5, ty - 2.5, 5, 4.5, 2, c.skin.shadow);
  drawBall(ctx, 0, hy, 9.5, c.skin);
  pen.circle(9.1, hy + 2.8, 1.5, c.skin.base);
  const mood = pose.mood ?? 'neutral';
  const blink = pose.blink ?? (pose.time !== undefined && time % BLINK_CYCLE_MS < BLINK_DURATION_MS);
  pen.circle(5.4, hy + 4.4, 1.7, BLUSH, 0.3);
  if (recipe.freckles) {
    for (const [fx, fy] of [[4.2, 3], [5.8, 2.4], [6.4, 3.8]]) pen.circle(fx, hy + fy, 0.42, c.skin.deep, 0.75);
  }
  drawBeard(ctx, 'side');
  drawEye(ctx, 4.9, hy + 1.8, mood, blink);
  if (mood === 'focus') pen.rect(3.4, hy - 1.4, 3.4, 0.85, 0.4, c.hair.deep);
  drawMouth(ctx, 6.4, hy + 4.8, mood);
  const earShows = ['buzz', 'mohawk', 'bald'].includes(recipe.hair);
  drawGlasses(ctx, 'side');
  hairPass(ctx, 'side', 'front');
  if (earShows) {
    pen.circle(-1.8, hy + 2, 2.1, c.skin.shadow);
    pen.circle(-2.1, hy + 1.7, 1.4, c.skin.base);
  }
  drawHat(ctx, 'side');
  drawHeadset(ctx, 'side');
}

function drawSide(ctx: CharacterContext): void {
  const sw = ctx.bw - 4;
  const sh = sw / 2;
  hairPass(ctx, 'side', 'behind');
  drawSideLegs(ctx, sh);
  drawSideFarArm(ctx);
  drawSideTorso(ctx, sw, sh);
  drawSideNearArm(ctx);
  drawSideHead(ctx);
}

/** Renders a character onto a Pen using its recipe and pose. */
export function drawCharacter(pen: Pen, recipe: Recipe, pose: Pose): void {
  const ctx = createCharacterContext(pen, recipe, pose);

  if (pose.shadow) pen.ellipse(0, 0, 24 + ctx.build * 2, 8, SHADOW_COLOR, SHADOW_ALPHA);

  if (pose.seated) pen.push(0, SEAT_Y_OFFSET_PX);

  if (ctx.side) {
    pen.push(0, 0, 0, ctx.dir === 'left' ? -1 : 1);
    drawSide(ctx);
    pen.pop();
  } else {
    drawFrontOrBack(ctx, ctx.dir === 'down');
  }

  if (pose.seated) pen.pop();
}
