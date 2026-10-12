/** Unit tests for the kitchen café rules: menu lookup, reward caps, coin units and the earning day. */
import { describe, expect, it } from 'vitest';
import { distanceToItem } from '../office/layout/geometry';
import {
  cappedReward,
  DAILY_EARN_CAP,
  fromUnits,
  KITCHEN_REACH_TILES,
  MENU,
  menuItem,
  REWARD,
  startOfUtcDay,
  toUnits,
} from './kitchen.rules';

describe('menu', () => {
  it('has water, Pepsi and dinner with unique on-chain ids and positive prices', () => {
    expect(MENU.map((m) => m.key)).toEqual(['water', 'pepsi', 'dinner']);
    expect(new Set(MENU.map((m) => m.id)).size).toBe(MENU.length);
    for (const m of MENU) expect(m.price).toBeGreaterThan(0);
  });

  it('finds items by key only', () => {
    expect(menuItem('pepsi')?.name).toBe('Pepsi');
    expect(menuItem('beer')).toBeNull();
    expect(menuItem(undefined)).toBeNull();
    expect(menuItem({ key: 'water' })).toBeNull();
  });

  it('lets the welcome grant buy a dinner, and the daily allowance a drink', () => {
    expect(REWARD.WELCOME).toBeGreaterThanOrEqual(menuItem('dinner')!.price);
    expect(REWARD.DAILY).toBeGreaterThanOrEqual(menuItem('pepsi')!.price);
  });
});

describe('cappedReward', () => {
  it('pays in full under the cap, partly at the edge, nothing past it', () => {
    expect(cappedReward(3, 0)).toBe(3);
    expect(cappedReward(3, DAILY_EARN_CAP - 2)).toBe(2);
    expect(cappedReward(3, DAILY_EARN_CAP)).toBe(0);
    expect(cappedReward(3, DAILY_EARN_CAP + 10)).toBe(0);
  });
});

describe('coin units', () => {
  it('converts whole coins to 18-decimal units and back', () => {
    expect(toUnits(6)).toBe(6n * 10n ** 18n);
    expect(fromUnits(toUnits(20))).toBe(20);
  });
});

describe('startOfUtcDay', () => {
  it('is midnight UTC of the same UTC day', () => {
    expect(startOfUtcDay(new Date('2026-10-12T23:59:59Z')).toISOString()).toBe(
      '2026-10-12T00:00:00.000Z',
    );
    expect(startOfUtcDay(new Date('2026-10-13T00:00:00Z')).toISOString()).toBe(
      '2026-10-13T00:00:00.000Z',
    );
  });
});

describe('distanceToItem (standing at the kitchen)', () => {
  const fridge = { id: 'f', kind: 'fridge' as const, x: 10, y: 2, w: 1.5, h: 1.3 };

  it('is 0 on the item and grows with the gap to its edge', () => {
    expect(distanceToItem(10, 2, fridge)).toBe(0);
    expect(distanceToItem(10, 2 + 0.65 + 1, fridge)).toBeCloseTo(1);
    expect(distanceToItem(10 + 0.75 + 3, 2 + 0.65 + 4, fridge)).toBeCloseTo(5);
  });

  it('accepts someone in front of the fridge and refuses someone across the room', () => {
    expect(distanceToItem(10, 4, fridge)).toBeLessThanOrEqual(KITCHEN_REACH_TILES);
    expect(distanceToItem(20, 12, fridge)).toBeGreaterThan(KITCHEN_REACH_TILES);
  });

  it('accounts for rotation', () => {
    const turned = { ...fridge, w: 4, h: 1, rotation: 90 as const };
    expect(distanceToItem(10, 3.5, turned)).toBe(0);
    expect(distanceToItem(12, 2, turned)).toBeCloseTo(1.5);
  });
});
