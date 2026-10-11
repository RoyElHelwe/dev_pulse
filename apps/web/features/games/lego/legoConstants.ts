/**
 * Shared constants, default settings, and numeric limits for the Lego wall mini-game.
 * Keeps UI measurements and API rule mirrors synchronized.
 */

import type { LegoBrick } from '@/game/render/legoArt';

/**
 * Total board width in stud units.
 * Mirror of apps/api/src/games/lego/lego.rules.ts: keep in sync
 */
export const BOARD_WIDTH_STUDS = 48; // Mirror of apps/api/src/games/lego/lego.rules.ts: keep in sync

/**
 * Total board height in stud units.
 * Mirror of apps/api/src/games/lego/lego.rules.ts: keep in sync
 */
export const BOARD_HEIGHT_STUDS = 32; // Mirror of apps/api/src/games/lego/lego.rules.ts: keep in sync

/**
 * Total supported colors in the brick palette.
 * Mirror of apps/api/src/games/lego/lego.rules.ts: keep in sync
 */
export const PALETTE_COLOR_COUNT = 16; // Mirror of apps/api/src/games/lego/lego.rules.ts: keep in sync

/**
 * Interval for throttling live artwork broadcasts to the office space.
 * Mirror of apps/api/src/games/lego/lego.service.ts: keep in sync
 */
export const ART_BROADCAST_THROTTLE_MS = 300; // Mirror of apps/api/src/games/lego/lego.service.ts: keep in sync

/** Default square stud size in CSS pixels on board mount. */
export const DEFAULT_CELL_SIZE_PX = 16;

/** Minimum allowed square stud size in CSS pixels to maintain visibility. */
export const MIN_CELL_SIZE_PX = 8;

/** Default selected shape index (1x2 brick). */
export const DEFAULT_SHAPE_INDEX = 1;

/** Default selected color index (red). */
export const DEFAULT_COLOR_INDEX = 4;

/** Duration before transient validation or server errors disappear automatically. */
export const ERROR_DISMISS_DELAY_MS = 3000;

/** Pointer button code for primary / left click. */
export const MOUSE_BUTTON_PRIMARY = 0;

/** Pointer button code for context menu / right click. */
export const MOUSE_BUTTON_SECONDARY = 2;

// Canvas render proportions and styling constants
export const BASEPLATE_STUD_SHADOW_OFFSET_RATIO = 0.03;
export const BASEPLATE_STUD_SHADOW_RADIUS_RATIO = 0.16;
export const BASEPLATE_STUD_RADIUS_RATIO = 0.14;

export const BRICK_STUD_SHADOW_OFFSET_RATIO = 0.05;
export const BRICK_STUD_SHADOW_RADIUS_RATIO = 0.25;
export const BRICK_STUD_RADIUS_RATIO = 0.24;
export const BRICK_STUD_MIN_STROKE_WIDTH_PX = 0.5;
export const BRICK_STUD_STROKE_WIDTH_RATIO = 0.05;
export const BRICK_STUD_HIGHLIGHT_OFFSET_RATIO = 0.06;
export const BRICK_STUD_HIGHLIGHT_RADIUS_RATIO = 0.09;

export const GHOST_VALID_STUD_RADIUS_RATIO = 0.22;
export const GHOST_INVALID_STUD_RADIUS_RATIO = 0.19;
export const GHOST_VALID_FILL_ALPHA = 0.65;
export const GHOST_INVALID_FILL_ALPHA = 0.45;
export const GHOST_VALID_LINE_WIDTH_PX = 1.5;
export const GHOST_INVALID_LINE_WIDTH_PX = 2;

export const ERASE_TARGET_LINE_WIDTH_PX = 2;
export const ERASE_CELL_LINE_WIDTH_PX = 1.5;

/** State synchronization payload received from the game server. */
export interface LegoState {
  ready?: boolean;
  w?: number;
  h?: number;
  bricks: LegoBrick[];
  canClear: boolean;
  players: string[];
  version: number;
}
