/**
 * Uno game UI constants and styling lookups.
 * Defines player limits, stack rules, and color indicator classes.
 */

import type { Color } from './types';

/** Maximum number of players allowed to seat in an Uno lobby. */
export const MAX_SEATED_PLAYERS = 6;

/** Minimum players required before the host can start a match. */
export const MIN_PLAYERS_TO_START = 2;

/** Hand size threshold under which a player must call UNO. */
export const UNO_CALL_MAX_HAND_SIZE = 2;

/** Draw penalty count for a standard Draw Two card. */
export const DRAW_TWO_COUNT = 2;

/** Draw penalty count for a Wild Draw Four card. */
export const DRAW_FOUR_COUNT = 4;

/** Ring highlight classes matching active card colors. */
export const ACTIVE_COLOR_RING: Record<Color, string> = {
  red: 'ring-4 ring-red-500 shadow-red-500/20',
  yellow: 'ring-4 ring-yellow-400 shadow-yellow-400/20',
  green: 'ring-4 ring-green-600 shadow-green-600/20',
  blue: 'ring-4 ring-blue-600 shadow-blue-600/20',
};

/** Background color classes matching active card colors. */
export const ACTIVE_COLOR_BG: Record<Color, string> = {
  red: 'bg-red-500',
  yellow: 'bg-yellow-400',
  green: 'bg-green-600',
  blue: 'bg-blue-600',
};

/** Default ring highlight style when no color is chosen. */
export const DEFAULT_COLOR_RING = 'ring-2 ring-zinc-300';

/** Default background color dot style when no color is chosen. */
export const DEFAULT_COLOR_BG = 'bg-zinc-400';
