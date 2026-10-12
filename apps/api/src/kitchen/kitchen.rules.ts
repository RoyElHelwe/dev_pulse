/**
 * Pure rules of the kitchen café and PulseCoin: menu and prices, rewards, caps, and where you must stand.
 * The menu is mirrored on-chain (KitchenShop items), where the price actually charged lives.
 */

import { formatUnits, parseUnits } from 'ethers';

/** Something on the kitchen menu. `id` is the item id in the KitchenShop contract. */
export interface MenuItem {
  id: number;
  key: 'water' | 'pepsi' | 'dinner';
  name: string;
  /** Whole PulseCoins. */
  price: number;
  description: string;
}

export const MENU: readonly MenuItem[] = [
  { id: 1, key: 'water', name: 'Water', price: 1, description: 'A cold bottle of water.' },
  { id: 2, key: 'pepsi', name: 'Pepsi', price: 2, description: 'A chilled can of Pepsi.' },
  { id: 3, key: 'dinner', name: 'Dinner', price: 6, description: 'The plate of the day, hot.' },
];

/** Coins paid for each kind of reward. DAILY must match PulseCoin.DAILY_ALLOWANCE. */
export const REWARD = {
  /** Once, when a member's wallet is created. */
  WELCOME: 20,
  DAILY: 5,
  /** Closing a task (moving it to Done for the first time). */
  TASK: 3,
  /** Each winner of a game. */
  GAME: 2,
} as const;

/** Most an owner / admin can give in one grant. */
export const MAX_GRANT = 50;
/** Most coins earned from tasks and games per person per (UTC) day, so closing junk tasks can't farm coins. */
export const DAILY_EARN_CAP = 30;

/** How long a bought item stays in the avatar's hand. */
export const HOLD_MS = 3 * 60_000;
/** You buy at the kitchen: within this many tiles of its fridge or counter. */
export const KITCHEN_FURNITURE = ['fridge', 'counter'] as const;
export const KITCHEN_REACH_TILES = 2.5;

/** PulseCoin has 18 decimals, like ether; the app only deals in whole coins. */
export const COIN_DECIMALS = 18;
export const toUnits = (coins: number): bigint => parseUnits(String(coins), COIN_DECIMALS);
export const fromUnits = (units: bigint): number => Number(formatUnits(units, COIN_DECIMALS));

/** The menu item for a key from a request, or null. */
export function menuItem(key: unknown): MenuItem | null {
  return MENU.find((m) => m.key === key) ?? null;
}

/** What is left of a reward once the person's daily earning cap is applied (0: nothing to pay). */
export function cappedReward(amount: number, earnedToday: number, cap = DAILY_EARN_CAP): number {
  return Math.max(0, Math.min(amount, cap - earnedToday));
}

/** Midnight UTC of the day `now` falls in (start of the earning-cap day). */
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
