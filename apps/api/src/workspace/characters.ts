import { ValidateBy } from 'class-validator';

/** The named characters (apps/web/game/art/recipe.ts, PRESETS). */
export const CHARACTERS = ['maya', 'sam', 'noor', 'lea', 'omar', 'kai', 'zoe', 'ivan'] as const;

/**
 * A character can also be a recipe code: "1" + one base-36 digit per choice
 * (body, hair, outfit...). These are the number of options for each choice, in
 * order: the same list as DNA_SIZES in apps/web/game/art/recipe.ts (keep both in sync).
 */
export const DNA_SIZES = [3, 3, 10, 12, 12, 4, 4, 2, 5, 16, 16, 3, 3, 10, 6, 3, 16, 5];

export function isCharacter(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if ((CHARACTERS as readonly string[]).includes(value)) return true;
  if (value.length !== DNA_SIZES.length + 1 || value[0] !== '1') return false;
  return DNA_SIZES.every((size, i) => {
    const digit = value[i + 1];
    return /^[0-9a-z]$/.test(digit) && parseInt(digit, 36) < size;
  });
}

/** Validation: a named character or a valid recipe code. */
export function IsCharacter() {
  return ValidateBy({
    name: 'isCharacter',
    validator: { validate: isCharacter, defaultMessage: () => 'Pick a character.' },
  });
}

export function randomCharacter() {
  return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
}
