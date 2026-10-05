// Colour in OKLCH: lightness 0..1, chroma 0..~0.37, hue in degrees.
// OKLCH is "perceptually uniform": two colours with the same L look equally
// light, which HSL can't promise. So palettes built here stay balanced: no
// generated shirt glows brighter than the others.

/** A colour as the game uses it: 0xRRGGBB. */
export type Hex = number;

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

/** OKLCH → linear sRGB (may be out of 0..1 when the colour is out of gamut). */
function toLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

/**
 * OKLCH → 0xRRGGBB. Out-of-gamut colours lose chroma (not hue or lightness)
 * until they fit, so a ramp never jumps hue at its bright or dark end.
 */
export function oklch(l: number, c: number, h: number): Hex {
  const L = Math.min(1, Math.max(0, l));
  let lo = 0;
  let hi = Math.max(0, c);
  let rgb = toLinearRgb({ l: L, c: hi, h });
  if (!inGamut(rgb)) {
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(toLinearRgb({ l: L, c: mid, h }))) lo = mid;
      else hi = mid;
    }
    rgb = toLinearRgb({ l: L, c: lo, h });
  }
  const [r, g, b] = rgb.map((v) => Math.round(Math.min(1, Math.max(0, gamma(v))) * 255));
  return (r << 16) | (g << 8) | b;
}

/** 0xRRGGBB → OKLCH (used to rebuild ramps from existing colours). */
export function toOklch(hex: Hex): Oklch {
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const r = lin((hex >> 16) & 255);
  const g = lin((hex >> 8) & 255);
  const b = lin(hex & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363015253 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: (h + 360) % 360 };
}

/** Move hue `from` towards `to` by up to `amount` degrees, the short way round. */
function turn(from: number, to: number, amount: number) {
  const diff = ((to - from + 540) % 360) - 180;
  const step = Math.sign(diff) * Math.min(Math.abs(diff), amount);
  return (from + step + 360) % 360;
}

/** Where light pulls hues (warm yellow) and where shade pulls them (blue violet). */
const WARM_HUE = 85;
const COOL_HUE = 285;

/**
 * Five tones of one material, darkest to brightest. Shadows don't just get
 * darker: they turn cooler (towards blue violet) and highlights warmer
 * (towards yellow), the "hue shifting" painters and pixel artists use so
 * shading glows instead of turning muddy.
 */
export interface Ramp {
  deep: Hex;
  shadow: Hex;
  base: Hex;
  light: Hex;
  glint: Hex;
}

export interface RampOptions {
  /** Lightness change per step (default 0.075). */
  step?: number;
  /** Hue change per step, in degrees (default 9). */
  shift?: number;
}

export function ramp(l: number, c: number, h: number, options: RampOptions = {}): Ramp {
  const step = options.step ?? 0.075;
  const shift = options.shift ?? 9;
  // Greys get a little chroma in their shadows, so even they shade cool.
  const tone = (k: number) => {
    const hue = k < 0 ? turn(h, COOL_HUE, -k * shift) : turn(h, WARM_HUE, k * shift);
    const chroma = k < 0 ? Math.max(c * (1 + 0.08 * -k), 0.012 * -k) : c * (1 - 0.12 * k);
    const lightness = l + k * (k < 0 ? step * 1.15 : step);
    return oklch(lightness, chroma, c < 0.015 && k < 0 ? COOL_HUE : hue);
  };
  return { deep: tone(-2), shadow: tone(-1), base: tone(0), light: tone(1), glint: tone(2) };
}

/** Same ramp, built around an existing 0xRRGGBB colour. */
export function rampOf(hex: Hex, options?: RampOptions): Ramp {
  const { l, c, h } = toOklch(hex);
  return ramp(l, c, h, options);
}

/** Mix two colours in OKLCH (t = 0 → a, 1 → b). */
export function mix(a: Hex, b: Hex, t: number): Hex {
  const A = toOklch(a);
  const B = toOklch(b);
  const diff = ((B.h - A.h + 540) % 360) - 180;
  // A grey has no meaningful hue: take the other colour's.
  const h = A.c < 0.01 ? B.h : B.c < 0.01 ? A.h : A.h + diff * t;
  return oklch(A.l + (B.l - A.l) * t, A.c + (B.c - A.c) * t, h);
}

/** The old way of shading (straight towards black or white), kept to compare. */
export function flatShade(color: Hex, amount: number): Hex {
  const channel = (v: number) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
  return (channel((color >> 16) & 255) << 16) | (channel((color >> 8) & 255) << 8) | channel(color & 255);
}

/** Old-style ramp (RGB darken / lighten), for side-by-side comparisons. */
export function flatRamp(hex: Hex): Ramp {
  return {
    deep: flatShade(hex, -0.38),
    shadow: flatShade(hex, -0.2),
    base: hex,
    light: flatShade(hex, 0.18),
    glint: flatShade(hex, 0.36),
  };
}

export const css = (hex: Hex) => `#${hex.toString(16).padStart(6, '0')}`;
