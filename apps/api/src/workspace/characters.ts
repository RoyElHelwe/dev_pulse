/**
 * Character presets and DNA recipe validation for avatar appearances.
 */

import { ValidateBy } from 'class-validator';

const DNA_VERSION_PREFIX = '1';
const DNA_RADIX = 36;

/** The named characters (apps/web/game/art/recipe.ts, PRESETS). */
const CHARACTERS = ['maya', 'sam', 'noor', 'lea', 'omar', 'kai', 'zoe', 'ivan'] as const;

/** Number of customization options per DNA trait slot for procedural avatar codes. */
export const DNA_SIZES = [3, 3, 10, 12, 12, 4, 4, 2, 5, 16, 16, 3, 3, 10, 6, 3, 16, 5];

/** Checks whether a value matches a preset avatar name or a valid DNA recipe code. */
export function isCharacter(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if ((CHARACTERS as readonly string[]).includes(value)) return true;
  if (value.length !== DNA_SIZES.length + 1 || value[0] !== DNA_VERSION_PREFIX) return false;
  return DNA_SIZES.every((size, i) => {
    const digit = value[i + 1];
    return /^[0-9a-z]$/.test(digit) && parseInt(digit, DNA_RADIX) < size;
  });
}

/** Class-validator decorator verifying that a string is a valid character preset or DNA code. */
export function IsCharacter() {
  return ValidateBy({
    name: 'isCharacter',
    validator: { validate: isCharacter, defaultMessage: () => 'Pick a character.' },
  });
}

/** Selects a random character preset name from the available preset pool. */
export function randomCharacter() {
  return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
}

