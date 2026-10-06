import type { Role } from '@prisma/client';

export const RANK_GAP_MIN = 1e-6;

/**
 * Derives a 2-4 character uppercase prefix for task keys from a workspace name.
 * e.g. "Acme Rocket Co" -> "ARC", "Dev Pulse" -> "DP", "Zakaria" -> "ZAK", "A" -> "WS".
 */
export function workspacePrefix(name: string): string {
  if (!name) return 'WS';
  const words = name.match(/[a-zA-Z0-9]+/g);
  if (!words || words.length === 0) return 'WS';

  if (words.length === 1) {
    const clean = words[0].toUpperCase();
    if (clean.length < 2) return 'WS';
    return clean.slice(0, 3);
  }

  const initials = words.map((w) => w[0].toUpperCase()).join('').slice(0, 4);
  if (initials.length < 2) {
    const allChars = words.join('').toUpperCase();
    if (allChars.length >= 2) {
      return allChars.slice(0, Math.min(3, allChars.length));
    }
    return 'WS';
  }
  return initials;
}

/** Formats a task key such as "DP-42". */
export function taskKey(prefix: string, number: number): string {
  return `${prefix}-${number}`;
}

/**
 * Midpoint rank between two neighbours.
 * null before -> after - 1; null after -> before + 1; both null -> 1.
 */
export function rankBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1;
  if (before === null) return after! - 1;
  if (after === null) return before! + 1;
  return (before + after) / 2;
}

/** Only OWNER, ADMIN, or the reporter can delete a task. */
export function canDeleteTask(role: Role, userId: string, reporterId: string): boolean {
  return role === 'OWNER' || role === 'ADMIN' || userId === reporterId;
}

/** True when two adjacent ranks are too close and column needs rebalancing. */
export function needsRebalance(a: number, b: number): boolean {
  return Math.abs(a - b) < RANK_GAP_MIN;
}
