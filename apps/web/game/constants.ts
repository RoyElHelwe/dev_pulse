/**
 * Shared game engine constants and configuration parameters.
 * Defines dimensions, physics body bounds, camera zooms, networking rates, seating, and depth bands.
 */

// ---- Tiles & movement ------------------------------------------------------
// World tile metrics and avatar locomotion speeds in the 2D office space.
/** Size of one map tile in pixels. Layouts are written in tiles (1 tile ≈ 50 cm). */
export const TILE = 32;

/** Walking speed in pixels per second. */
export const WALK_SPEED = 170;

// ---- Player body -----------------------------------------------------------
// Collision hull dimensions and feet anchor offsets for avatar physics bodies.
/** Local player physics body width in pixels. */
export const PLAYER_BODY_WIDTH_PX = 18;

/** Local player physics body height in pixels. */
export const PLAYER_BODY_HEIGHT_PX = 10;

/** Local player physics body horizontal offset from feet anchor in pixels. */
export const PLAYER_BODY_OFFSET_X_PX = -9;

/** Local player physics body vertical offset from feet anchor in pixels. */
export const PLAYER_BODY_OFFSET_Y_PX = -10;

// ---- Camera & zoom ---------------------------------------------------------
// Viewport magnification limits, tween timings, margins, and follow speeds.
/** Minimum allowable zoom level. */
export const ZOOM_MIN = 0.6;

/** Maximum allowable zoom level. */
export const ZOOM_MAX = 1.5;

/** View margin in pixels above the office bounds for wall faces and labels. */
export const VIEW_MARGIN_TOP_PX = 140;

/** View margin in pixels below the office bounds. */
export const VIEW_MARGIN_BOTTOM_PX = 40;

/** Zoom factor per mouse wheel tick. */
export const WHEEL_ZOOM_STEP = 1.12;

/** Camera zoom transition duration in milliseconds. */
export const ZOOM_TWEEN_MS = 160;

/** Camera zoom reset transition duration in milliseconds. */
export const ZOOM_RESET_TWEEN_MS = 220;

/** Reference viewport width in tiles for calculating base zoom. */
export const BASE_ZOOM_REF_WIDTH_TILES = 26;

/** Minimum base zoom factor before user zoom is applied. */
export const BASE_ZOOM_MIN = 0.75;

/** Maximum base zoom factor before user zoom is applied. */
export const BASE_ZOOM_MAX = 1.5;

/** Camera follow smoothing lerp factor. */
export const CAMERA_LERP = 0.12;

/** Camera clear / background color behind the office floor. */
export const CAMERA_BG_COLOR = '#e4e0da';

// ---- Scenery baking --------------------------------------------------------
// Chunk dimensions, scaling constraints, and memory limits for static scenery bake.
/** Pixel size of chunked static scenery render textures. */
export const CHUNK_PX = 512;

/** Padding in pixels around each static scenery chunk to prevent seam artifacts. */
export const PAD_PX = 2;

/** Maximum pixel budget across all static scenery textures to prevent GPU memory exhaustion. */
export const MAX_TEXTURE_PIXELS = 16e6;

/** Upper bound for static scenery render texture scaling. */
export const MAX_SCENERY_SCALE = 3;

/** DPR multiplier for static scenery texture resolution. */
export const DPR_SCENERY_FACTOR = 1.5;

// ---- Networking -------------------------------------------------------------
// Network broadcast cadences and proximity distance polling intervals.
/** Send the local position at most every 50 ms (20 per second) while walking. */
export const SEND_INTERVAL_MS = 50;

/** Cadence in milliseconds for calculating proximity audio / tile points. */
export const PROXIMITY_TICK_MS = 100;

// ---- Seating ----------------------------------------------------------------
// Dwell thresholds, occupancy radii, and geometric offsets for sitting mechanics.
/** Milliseconds the player must dwell near a seat before sitting down. */
export const SIT_DWELL_MS = 500;

/** Milliseconds of directional input required to stand up from a seat. */
export const STAND_HOLD_MS = 500;

/** Radius in pixels around a seat within which another player is considered occupying it. */
export const SEAT_TAKEN_RADIUS_PX = 14;

/** Vertical pixel offset applied to seated player position relative to seat center. */
export const SEAT_Y_OFFSET_PX = 5;

/** Distance in pixels to step off when standing up from a chair. */
export const STEP_OFF_DISTANCE_PX = 22;

/** Extra margin in pixels around an armchair bounding box for sitting detection. */
export const ARMCHAIR_MARGIN_PX = 8;

/** Interaction zone radius fraction in tiles around standard seats (chairs and stools). */
export const SEAT_ZONE_TILES = 0.45;

// ---- Depth & layer sorting --------------------------------------------------
// Depth sort divisors and relative z-offsets for sorting sprites and furniture.
/** Divisor for converting Y pixel coordinates to depth fractions. */
export const DEPTH_SORT_DIVISOR = 100_000;

/** Epsilon offset added to wall-mounted items so they render in front of their wall face. */
export const WALL_MOUNTED_DEPTH_OFFSET = 1e-7;

/** Epsilon offset added to seated characters so they render in front of their chair. */
export const SEATED_DEPTH_OFFSET = 0.000001;

/** Radius in pixels around a seat within which a seated player is depth-linked to the seat item. */
export const SEATED_DEPTH_RADIUS_PX = 24;

/** Offset added to desk nameplates depth above the sorted depth band. */
export const DESK_PLATE_DEPTH_OFFSET = 0.9;

