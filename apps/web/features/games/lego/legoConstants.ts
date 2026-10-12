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
const PALETTE_COLOR_COUNT = 16; // Mirror of apps/api/src/games/lego/lego.rules.ts: keep in sync

/**
 * Interval for throttling live artwork broadcasts to the office space.
 * Mirror of apps/api/src/games/lego/lego.service.ts: keep in sync
 */
const ART_BROADCAST_THROTTLE_MS = 300; // Mirror of apps/api/src/games/lego/lego.service.ts: keep in sync

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
/** Vertical drop shadow offset ratio relative to stud cell size for baseplate grid dots. */
export const BASEPLATE_STUD_SHADOW_OFFSET_RATIO = 0.03;
/** Drop shadow circle radius ratio relative to stud cell size for baseplate grid dots. */
export const BASEPLATE_STUD_SHADOW_RADIUS_RATIO = 0.16;
/** Stud dot radius ratio relative to stud cell size for unpopulated baseplate grid cells. */
export const BASEPLATE_STUD_RADIUS_RATIO = 0.14;

/** Vertical drop shadow offset ratio relative to stud cell size for placed brick studs. */
export const BRICK_STUD_SHADOW_OFFSET_RATIO = 0.05;
/** Drop shadow radius ratio relative to stud cell size for placed brick studs. */
export const BRICK_STUD_SHADOW_RADIUS_RATIO = 0.25;
/** Cylindrical stud radius ratio relative to stud cell size for placed brick studs. */
export const BRICK_STUD_RADIUS_RATIO = 0.24;
/** Minimum stroke width in pixels for brick stud boundary outlines. */
export const BRICK_STUD_MIN_STROKE_WIDTH_PX = 0.5;
/** Stroke width ratio relative to stud cell size for brick stud outlines. */
export const BRICK_STUD_STROKE_WIDTH_RATIO = 0.05;
/** Highlight reflection diagonal offset ratio relative to stud cell size for brick studs. */
export const BRICK_STUD_HIGHLIGHT_OFFSET_RATIO = 0.06;
/** Highlight reflection spot radius ratio relative to stud cell size for brick studs. */
export const BRICK_STUD_HIGHLIGHT_RADIUS_RATIO = 0.09;

/** Preview stud circle radius ratio relative to stud cell size for valid placement locations. */
export const GHOST_VALID_STUD_RADIUS_RATIO = 0.22;
/** Preview stud circle radius ratio relative to stud cell size for invalid placement locations. */
export const GHOST_INVALID_STUD_RADIUS_RATIO = 0.19;
/** Canvas fill opacity on a 0 to 1 scale for valid brick placement previews. */
export const GHOST_VALID_FILL_ALPHA = 0.65;
/** Canvas fill opacity on a 0 to 1 scale for invalid brick placement previews. */
export const GHOST_INVALID_FILL_ALPHA = 0.45;
/** Outline stroke width in pixels for valid placement preview ghosts. */
export const GHOST_VALID_LINE_WIDTH_PX = 1.5;
/** Outline stroke width in pixels for invalid placement warning ghosts. */
export const GHOST_INVALID_LINE_WIDTH_PX = 2;

/** Highlight outline width in pixels around a targeted brick queued for deletion. */
export const ERASE_TARGET_LINE_WIDTH_PX = 2;
/** Stroke width in pixels for the boundary box drawn over hovered cells in erase mode. */
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
