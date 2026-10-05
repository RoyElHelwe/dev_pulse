import { pick, type Random } from '../render/draw';
import { BOTTOM, CLOTH, DYED_FROM, HAIR, SHOES, SKIN } from './palette';

// A character is a recipe: a handful of choices from fixed menus. It's stored
// as a short code ("DNA") in WorkspaceMember.character, next to the 8 named
// presets that existed before, so old members keep their look.

export const BUILDS = ['slim', 'regular', 'broad'] as const;
export const HAIR_STYLES = ['short', 'buzz', 'sidepart', 'long', 'bob', 'bun', 'ponytail', 'curly', 'afro', 'mohawk', 'braids', 'bald'] as const;
export const BEARDS = ['none', 'stubble', 'full', 'moustache'] as const;
export const GLASSES = ['none', 'round', 'square', 'shades'] as const;
export const TOPS = ['tee', 'hoodie', 'shirt', 'sweater', 'blazer'] as const;
export const PATTERNS = ['plain', 'stripes', 'logo'] as const;
export const BOTTOMS = ['trousers', 'shorts', 'skirt'] as const;
export const HATS = ['none', 'beanie', 'cap'] as const;
/** How someone keeps their desk (see desk.ts). */
export const VIBES = ['minimal', 'cozy', 'gamer', 'artist', 'scholar'] as const;

export type Build = (typeof BUILDS)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type Beard = (typeof BEARDS)[number];
export type Glasses = (typeof GLASSES)[number];
export type Top = (typeof TOPS)[number];
export type Pattern = (typeof PATTERNS)[number];
export type Bottom = (typeof BOTTOMS)[number];
export type Hat = (typeof HATS)[number];
export type Vibe = (typeof VIBES)[number];

export interface Recipe {
  build: Build;
  /** 0 short, 1 average, 2 tall. */
  height: number;
  /** Indexes into the palette lists (SKIN, HAIR, CLOTH, BOTTOM, SHOES). */
  skin: number;
  hair: HairStyle;
  hairColor: number;
  beard: Beard;
  glasses: Glasses;
  freckles: boolean;
  top: Top;
  topColor: number;
  /** Second colour: stripes, logo, collar, blazer shirt, pompom. */
  trimColor: number;
  pattern: Pattern;
  bottom: Bottom;
  bottomColor: number;
  shoes: number;
  hat: Hat;
  hatColor: number;
  vibe: Vibe;
}

type Key = keyof Recipe;

/** Every field, in DNA order (append only: old codes must keep decoding). */
export const FIELDS: { key: Key; size: number; options?: readonly string[] }[] = [
  { key: 'build', size: BUILDS.length, options: BUILDS },
  { key: 'height', size: 3 },
  { key: 'skin', size: SKIN.length },
  { key: 'hair', size: HAIR_STYLES.length, options: HAIR_STYLES },
  { key: 'hairColor', size: HAIR.length },
  { key: 'beard', size: BEARDS.length, options: BEARDS },
  { key: 'glasses', size: GLASSES.length, options: GLASSES },
  { key: 'freckles', size: 2 },
  { key: 'top', size: TOPS.length, options: TOPS },
  { key: 'topColor', size: CLOTH.length },
  { key: 'trimColor', size: CLOTH.length },
  { key: 'pattern', size: PATTERNS.length, options: PATTERNS },
  { key: 'bottom', size: BOTTOMS.length, options: BOTTOMS },
  { key: 'bottomColor', size: BOTTOM.length },
  { key: 'shoes', size: SHOES.length },
  { key: 'hat', size: HATS.length, options: HATS },
  { key: 'hatColor', size: CLOTH.length },
  { key: 'vibe', size: VIBES.length, options: VIBES },
];

/** Field sizes in DNA order. The API keeps a copy to validate codes (apps/api/src/workspace/characters.ts). */
export const DNA_SIZES = FIELDS.map((f) => f.size);
const DNA_VERSION = '1';

const indexOf = (recipe: Recipe, field: (typeof FIELDS)[number]) => {
  const value = recipe[field.key];
  if (field.options) return field.options.indexOf(value as string);
  return typeof value === 'boolean' ? Number(value) : (value as number);
};

/** Recipe → "1" + one base-36 digit per field, e.g. "1a03k2…". */
export function encode(recipe: Recipe): string {
  return DNA_VERSION + FIELDS.map((f) => Math.max(0, indexOf(recipe, f)).toString(36)).join('');
}

/** Code → recipe, or null when it isn't a valid code. */
export function decode(code: string): Recipe | null {
  if (code.length !== FIELDS.length + 1 || code[0] !== DNA_VERSION) return null;
  const out: Record<string, unknown> = {};
  for (let i = 0; i < FIELDS.length; i++) {
    const field = FIELDS[i];
    const v = parseInt(code[i + 1], 36);
    if (Number.isNaN(v) || v >= field.size) return null;
    out[field.key] = field.options ? field.options[v] : field.key === 'freckles' ? v === 1 : v;
  }
  return out as unknown as Recipe;
}

const base: Recipe = {
  build: 'regular',
  height: 1,
  skin: 2,
  hair: 'short',
  hairColor: 1,
  beard: 'none',
  glasses: 'none',
  freckles: false,
  top: 'tee',
  topColor: 0,
  trimColor: 8,
  pattern: 'plain',
  bottom: 'trousers',
  bottomColor: 2,
  shoes: 0,
  hat: 'none',
  hatColor: 9,
  vibe: 'minimal',
};

/** The 8 characters from before, redrawn as recipes (same skin, hair and colours). */
export const PRESETS: Record<string, Recipe> = {
  maya: { ...base, skin: 2, hair: 'long', hairColor: 1, top: 'sweater', topColor: 0, bottomColor: 2, vibe: 'cozy', glasses: 'round' },
  sam: { ...base, skin: 5, hair: 'short', hairColor: 0, top: 'hoodie', topColor: 1, bottomColor: 2, vibe: 'gamer', beard: 'stubble', shoes: 1 },
  noor: { ...base, skin: 7, hair: 'curly', hairColor: 0, top: 'shirt', topColor: 2, trimColor: 15, bottomColor: 3, vibe: 'scholar', shoes: 2 },
  lea: { ...base, skin: 1, hair: 'bun', hairColor: 4, top: 'tee', topColor: 3, pattern: 'stripes', trimColor: 15, bottom: 'skirt', bottomColor: 3, vibe: 'artist', freckles: true, shoes: 3 },
  omar: { ...base, skin: 4, hair: 'sidepart', hairColor: 1, top: 'blazer', topColor: 4, trimColor: 15, bottomColor: 0, vibe: 'minimal', beard: 'full', shoes: 2 },
  kai: { ...base, skin: 3, hair: 'short', hairColor: 0, top: 'hoodie', topColor: 12, bottomColor: 3, vibe: 'gamer', glasses: 'square', hat: 'beanie', hatColor: 9 },
  zoe: { ...base, skin: 6, hair: 'braids', hairColor: 3, top: 'tee', topColor: 10, pattern: 'logo', trimColor: 8, bottomColor: 2, vibe: 'cozy', shoes: 1 },
  ivan: { ...base, skin: 0, hair: 'curly', hairColor: 5, top: 'shirt', topColor: 3, trimColor: 15, bottomColor: 2, vibe: 'scholar', glasses: 'round', freckles: true },
};

export const PRESET_KEYS = Object.keys(PRESETS);

/** What `character` holds (preset name or DNA) → recipe. Unknown → the first preset. */
export function recipeOf(character: string | null | undefined): Recipe {
  if (!character) return PRESETS.maya;
  return PRESETS[character] ?? decode(character) ?? PRESETS.maya;
}

export function isCharacter(character: string) {
  return character in PRESETS || decode(character) !== null;
}

// ---------------------------------------------------------------------------
// Generating: weighted menus + a few rules that keep every result readable.

function weighted<T>(random: Random, entries: [T, number][]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = random() * total;
  for (const [value, w] of entries) {
    roll -= w;
    if (roll < 0) return value;
  }
  return entries[entries.length - 1][0];
}

const indexes = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Rules every generated character follows (the "harmony" rules). */
export const RULES = {
  /** Hair must stand out from the skin, or the head reads as one blob at 30 px. */
  hairVsSkin: 0.12,
  /** The outfit splits in two: top and bottom differ in lightness. */
  topVsBottom: 0.15,
  /** Stripes, logos and collars must be visible on the top. */
  trimVsTop: 0.2,
};

/** Hats that would fight these hairstyles' silhouettes aren't offered with them. */
export const HAT_FREE_HAIR: HairStyle[] = ['afro', 'mohawk', 'bun'];

function hairColorFor(random: Random, skin: number): number {
  const options: [number, number][] = HAIR.map((_, i) => [i, i >= DYED_FROM ? 3 : [18, 16, 12, 6, 5, 7, 7, 3, 4][i]]);
  for (let tries = 0; tries < 12; tries++) {
    const pickIndex = weighted(random, options);
    if (Math.abs(HAIR[pickIndex].l - SKIN[skin].l) >= RULES.hairVsSkin) return pickIndex;
  }
  return SKIN[skin].l > 0.6 ? 0 : 6;
}

function contrasting(random: Random, from: { l: number }[], against: number, min: number, avoid?: number) {
  const ok = indexes(from.length).filter((i) => i !== avoid && Math.abs(from[i].l - against) >= min);
  return pick(random, ok.length ? ok : indexes(from.length));
}

export function randomRecipe(random: Random): Recipe {
  const skin = Math.floor(random() * SKIN.length);
  const hair = weighted<HairStyle>(random, [
    ['short', 12], ['buzz', 6], ['sidepart', 8], ['long', 10], ['bob', 7], ['bun', 7],
    ['ponytail', 8], ['curly', 8], ['afro', 5], ['mohawk', 2], ['braids', 5], ['bald', 3],
  ]);
  const topColor = Math.floor(random() * CLOTH.length);
  const hat = HAT_FREE_HAIR.includes(hair) ? 'none' : weighted<Hat>(random, [['none', 78], ['beanie', 12], ['cap', 10]]);
  return {
    build: weighted<Build>(random, [['slim', 3], ['regular', 5], ['broad', 2]]),
    height: Math.floor(random() * 3),
    skin,
    hair,
    hairColor: hairColorFor(random, skin),
    beard: weighted<Beard>(random, [['none', 70], ['stubble', 13], ['full', 10], ['moustache', 7]]),
    glasses: weighted<Glasses>(random, [['none', 68], ['round', 13], ['square', 13], ['shades', 6]]),
    freckles: random() < 0.15,
    top: weighted<Top>(random, [['tee', 30], ['hoodie', 22], ['shirt', 18], ['sweater', 18], ['blazer', 12]]),
    topColor,
    trimColor: contrasting(random, CLOTH, CLOTH[topColor].l, RULES.trimVsTop, topColor),
    pattern: weighted<Pattern>(random, [['plain', 65], ['stripes', 20], ['logo', 15]]),
    bottom: weighted<Bottom>(random, [['trousers', 70], ['shorts', 12], ['skirt', 18]]),
    bottomColor: contrasting(random, BOTTOM, CLOTH[topColor].l, RULES.topVsBottom),
    shoes: weighted(random, [[0, 30], [1, 30], [2, 15], [3, 8], [4, 10], [5, 7]]),
    hat,
    hatColor: contrasting(random, CLOTH, CLOTH[topColor].l, 0.1, topColor),
    vibe: pick(random, VIBES),
  };
}

/** Keeps choices compatible after an edit, a mutation or breeding. */
export function tidy(recipe: Recipe): Recipe {
  return HAT_FREE_HAIR.includes(recipe.hair) && recipe.hat !== 'none' ? { ...recipe, hat: 'none' } : recipe;
}

/** A few fields re-rolled: "more like this one". */
export function mutate(recipe: Recipe, random: Random, changes = 1 + Math.floor(random() * 3)): Recipe {
  const fresh = randomRecipe(random);
  const out: Record<string, unknown> = { ...recipe };
  for (let i = 0; i < changes; i++) {
    const { key } = pick(random, FIELDS);
    out[key] = fresh[key];
  }
  return tidy(out as unknown as Recipe);
}

/** Each field from one parent or the other, sometimes with a small mutation. */
export function breed(a: Recipe, b: Recipe, random: Random): Recipe {
  const out: Record<string, unknown> = {};
  for (const { key } of FIELDS) out[key] = (random() < 0.5 ? a : b)[key];
  const child = tidy(out as unknown as Recipe);
  return random() < 0.35 ? mutate(child, random, 1) : child;
}
