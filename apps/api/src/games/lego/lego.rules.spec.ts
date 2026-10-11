import { describe, expect, it } from 'vitest';
import {
  type Brick,
  canClearBoard,
  createActionBudget,
  findBrickIndex,
  placeBrick,
  removeBrickAt,
} from './lego.rules';

describe('lego.rules pure functions', () => {
  describe('canClearBoard', () => {
    it('allows OWNER and ADMIN roles to clear', () => {
      expect(canClearBoard('OWNER')).toBe(true);
      expect(canClearBoard('ADMIN')).toBe(true);
    });

    it('denies MEMBER, guest, or undefined roles', () => {
      expect(canClearBoard('MEMBER')).toBe(false);
      expect(canClearBoard('GUEST')).toBe(false);
      expect(canClearBoard(undefined)).toBe(false);
    });
  });

  describe('findBrickIndex and removeBrickAt', () => {
    const bricks: Brick[] = [
      [0, 0, 2, 2, 1],
      [5, 5, 4, 2, 3],
    ];

    it('finds index of brick covering coordinates', () => {
      expect(findBrickIndex(bricks, 1, 1)).toBe(0);
      expect(findBrickIndex(bricks, 6, 6)).toBe(1);
      expect(findBrickIndex(bricks, 10, 10)).toBe(-1);
    });

    it('removes brick covering coordinates immutably', () => {
      const result = removeBrickAt(bricks, 1, 1);
      expect(result.removed).toBe(true);
      expect(result.nextBricks).toEqual([[5, 5, 4, 2, 3]]);
      // Original bricks array is unchanged
      expect(bricks).toHaveLength(2);
    });

    it('returns original array when no brick is found at coordinates', () => {
      const result = removeBrickAt(bricks, 20, 20);
      expect(result.removed).toBe(false);
      expect(result.nextBricks).toBe(bricks);
    });
  });

  describe('placeBrick', () => {
    it('appends a brick to the board list immutably', () => {
      const initial: Brick[] = [[0, 0, 1, 1, 0]];
      const placed: Brick = [2, 2, 2, 2, 1];
      const updated = placeBrick(initial, placed);

      expect(updated).toEqual([
        [0, 0, 1, 1, 0],
        [2, 2, 2, 2, 1],
      ]);
      expect(initial).toHaveLength(1);
    });
  });

  describe('createActionBudget', () => {
    it('creates a Budget enforcing 15 actions per second', () => {
      const budget = createActionBudget();
      const now = 10000;
      for (let i = 0; i < 15; i++) {
        expect(budget.allow(now)).toBe(true);
      }
      expect(budget.allow(now)).toBe(false);

      // In the next second window, budget resets
      expect(budget.allow(now + 1000)).toBe(true);
    });
  });
});
