import { type Hex, oklch, type Ramp, ramp } from './color';

// The whole cast and every desk prop take their colours from these lists, so
// any combination the generator picks still belongs to the same picture.
// Each entry is one material as a hue-shifted ramp (see color.ts).

export interface Swatch {
  name: string;
  ramp: Ramp;
  /** OKLCH lightness of the base tone, for contrast rules. */
  l: number;
}

const swatch = (name: string, l: number, c: number, h: number, step?: number): Swatch => ({
  name,
  ramp: ramp(l, c, h, { step }),
  l,
});

/** Skin tones, lightest to deepest. Small steps so shading stays gentle on faces. */
export const SKIN: Swatch[] = [
  swatch('porcelain', 0.9, 0.045, 62, 0.05),
  swatch('ivory', 0.85, 0.058, 60, 0.05),
  swatch('peach', 0.8, 0.07, 56, 0.05),
  swatch('sand', 0.74, 0.078, 60, 0.055),
  swatch('honey', 0.68, 0.088, 58, 0.055),
  swatch('amber', 0.61, 0.092, 52, 0.06),
  swatch('bronze', 0.54, 0.088, 50, 0.06),
  swatch('umber', 0.47, 0.078, 46, 0.06),
  swatch('cocoa', 0.4, 0.066, 42, 0.06),
  swatch('ebony', 0.33, 0.052, 38, 0.06),
];

/** Natural colours first; the last three are dyes (rarer in random picks). */
export const HAIR: Swatch[] = [
  swatch('black', 0.24, 0.012, 60),
  swatch('espresso', 0.31, 0.04, 50),
  swatch('chestnut', 0.41, 0.07, 52),
  swatch('auburn', 0.46, 0.12, 36),
  swatch('copper', 0.6, 0.14, 50),
  swatch('honey', 0.69, 0.1, 75),
  swatch('blonde', 0.82, 0.1, 92),
  swatch('platinum', 0.91, 0.035, 95),
  swatch('silver', 0.76, 0.012, 250),
  swatch('teal dye', 0.56, 0.1, 195),
  swatch('rose dye', 0.68, 0.13, 2),
  swatch('lilac dye', 0.67, 0.1, 305),
];
export const DYED_FROM = 9;

/** Tops, hats and accents. Chroma is capped (~0.13) so nobody outshines the UI. */
export const CLOTH: Swatch[] = [
  swatch('forest', 0.48, 0.08, 165),
  swatch('terracotta', 0.62, 0.13, 40),
  swatch('mustard', 0.78, 0.13, 85),
  swatch('ocean', 0.5, 0.11, 245),
  swatch('sage', 0.7, 0.06, 150),
  swatch('plum', 0.45, 0.1, 330),
  swatch('coral', 0.7, 0.13, 25),
  swatch('sky', 0.77, 0.08, 235),
  swatch('cream', 0.92, 0.03, 85),
  swatch('charcoal', 0.36, 0.012, 260),
  swatch('cherry', 0.53, 0.16, 20),
  swatch('teal', 0.58, 0.09, 195),
  swatch('lavender', 0.75, 0.08, 295),
  swatch('olive', 0.58, 0.08, 115),
  swatch('navy', 0.34, 0.07, 260),
  swatch('white', 0.96, 0.006, 90),
];

/** Trousers, skirts, shorts: mostly calm, so the top carries the colour. */
export const BOTTOM: Swatch[] = [
  swatch('raw denim', 0.38, 0.07, 255),
  swatch('light denim', 0.6, 0.07, 245),
  swatch('charcoal', 0.33, 0.012, 260),
  swatch('black', 0.25, 0.006, 260),
  swatch('khaki', 0.71, 0.06, 85),
  swatch('olive', 0.48, 0.06, 120),
  swatch('navy', 0.3, 0.06, 265),
  swatch('cream', 0.88, 0.03, 85),
  swatch('brick', 0.48, 0.11, 35),
  swatch('plum', 0.38, 0.08, 330),
];

export const SHOES: Swatch[] = [
  swatch('black', 0.25, 0.006, 260),
  swatch('white', 0.95, 0.008, 90),
  swatch('brown', 0.42, 0.06, 55),
  swatch('red', 0.56, 0.16, 25),
  swatch('navy', 0.32, 0.06, 262),
  swatch('sand', 0.78, 0.05, 80),
];

/** Desk tops (light from the template, the rest picked for the owner). */
export const WOOD = {
  maple: swatch('maple', 0.94, 0.018, 80, 0.05),
  oak: swatch('oak', 0.82, 0.05, 75, 0.06),
  walnut: swatch('walnut', 0.47, 0.045, 55),
  white: swatch('white', 0.97, 0.004, 90, 0.04),
  black: swatch('black', 0.3, 0.008, 260),
};

/** Hardware: monitors, keyboards, headsets. */
export const TECH = {
  body: swatch('graphite', 0.27, 0.01, 255),
  silver: swatch('silver', 0.82, 0.008, 250, 0.06),
  white: swatch('white', 0.97, 0.004, 250, 0.04),
};

export const PLANT = {
  leaf: swatch('leaf', 0.58, 0.12, 145),
  pothos: swatch('pothos', 0.66, 0.13, 130),
  cactus: swatch('cactus', 0.56, 0.09, 160),
};

export const PAPER = swatch('paper', 0.97, 0.01, 90, 0.04);
export const STICKY = [swatch('yellow', 0.92, 0.12, 100), swatch('pink', 0.85, 0.08, 0), swatch('mint', 0.9, 0.07, 165)];

/** Light colours (monitors, lamps, LEDs). */
export const GLOW = {
  screen: oklch(0.82, 0.08, 230),
  lamp: oklch(0.9, 0.09, 80),
  candle: oklch(0.85, 0.13, 65),
  led: oklch(0.8, 0.18, 150),
};

export const EYES: Hex = oklch(0.25, 0.015, 40);
export const BLUSH: Hex = oklch(0.72, 0.12, 15);
