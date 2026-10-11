/**
 * Spatial proximity helpers for minigame interactions in the virtual office.
 * Converts between player pixel coordinates and furniture tile coordinates to enforce interaction boundaries.
 */

import { TILE } from '../office/layout/geometry';

/**
 * Maximum Euclidean distance in tiles allowed for a player to initiate joining a minigame.
 * A player must be standing close to the furniture item to interact with it.
 */
export const JOIN_PROXIMITY_TILES = 4;

/**
 * Maximum Euclidean distance in tiles allowed before a player is automatically ejected from a minigame.
 * WHY: Join threshold (4 tiles) is tighter than leave threshold (7 tiles) to provide a hysteresis buffer;
 * this prevents jittering where slight movement near the boundary triggers rapid join/leave cycles.
 */
export const LEAVE_PROXIMITY_TILES = 7;

/**
 * Point representation in world pixel space (e.g. avatar positions).
 */
export interface PointPx {
  x: number;
  y: number;
}

/**
 * Point representation in tile grid coordinates (e.g. furniture layout positions).
 */
export interface PointTiles {
  x: number;
  y: number;
}

/**
 * Calculates Euclidean distance in tiles between a point in pixels (e.g. player)
 * and a point in tiles (e.g. furniture centre).
 */
export function distanceInTiles(playerPx: PointPx, targetTiles: PointTiles): number {
  const playerTilesX = playerPx.x / TILE;
  const playerTilesY = playerPx.y / TILE;
  return Math.hypot(playerTilesX - targetTiles.x, playerTilesY - targetTiles.y);
}

/**
 * Checks whether a player is within `maxTiles` distance of a target furniture point.
 */
export function isWithinProximity(
  playerPx: PointPx,
  targetTiles: PointTiles,
  maxTiles: number,
): boolean {
  return distanceInTiles(playerPx, targetTiles) <= maxTiles;
}
