import { TILE } from '../office/layout/geometry';

export const JOIN_PROXIMITY_TILES = 4;
export const LEAVE_PROXIMITY_TILES = 7;

export interface PointPx {
  x: number;
  y: number;
}

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
 * Checks whether a player is within `maxTiles` of a target point.
 */
export function isWithinProximity(
  playerPx: PointPx,
  targetTiles: PointTiles,
  maxTiles: number,
): boolean {
  return distanceInTiles(playerPx, targetTiles) <= maxTiles;
}
