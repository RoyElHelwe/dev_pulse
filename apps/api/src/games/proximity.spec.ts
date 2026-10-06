import { describe, expect, it } from 'vitest';
import { distanceInTiles, isWithinProximity, JOIN_PROXIMITY_TILES, LEAVE_PROXIMITY_TILES } from './proximity';

describe('Proximity Helper', () => {
  it('calculates distance in tiles accurately between pixels and tiles', () => {
    // Player at (0, 0) px -> (0, 0) tiles, target at (3, 4) tiles -> distance is 5 tiles
    const playerPx = { x: 0, y: 0 };
    const targetTiles = { x: 3, y: 4 };
    expect(distanceInTiles(playerPx, targetTiles)).toBe(5);
  });

  it('calculates distance when player is at offset pixels', () => {
    // 32 px = 1 tile
    const playerPx = { x: 32, y: 64 }; // (1, 2) tiles
    const targetTiles = { x: 1, y: 2 };
    expect(distanceInTiles(playerPx, targetTiles)).toBe(0);
  });

  it('validates join proximity (<= 4 tiles)', () => {
    const targetTiles = { x: 10, y: 10 };

    // Exactly 4 tiles away (4 * 32 = 128 px)
    expect(isWithinProximity({ x: (10 + 4) * 32, y: 10 * 32 }, targetTiles, JOIN_PROXIMITY_TILES)).toBe(true);

    // 3.9 tiles away
    expect(isWithinProximity({ x: (10 + 3.9) * 32, y: 10 * 32 }, targetTiles, JOIN_PROXIMITY_TILES)).toBe(true);

    // 4.1 tiles away
    expect(isWithinProximity({ x: (10 + 4.1) * 32, y: 10 * 32 }, targetTiles, JOIN_PROXIMITY_TILES)).toBe(false);
  });

  it('validates leave proximity (<= 7 tiles)', () => {
    const targetTiles = { x: 5, y: 5 };

    // 7 tiles away
    expect(isWithinProximity({ x: (5 + 7) * 32, y: 5 * 32 }, targetTiles, LEAVE_PROXIMITY_TILES)).toBe(true);

    // 7.2 tiles away
    expect(isWithinProximity({ x: (5 + 7.2) * 32, y: 5 * 32 }, targetTiles, LEAVE_PROXIMITY_TILES)).toBe(false);
  });
});
