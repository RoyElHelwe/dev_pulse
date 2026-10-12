/**
 * Pure task rules: key prefix, ordering ranks and delete permission. No DB or Nest here so they
 * can be unit tested (tasks.rules.spec.ts); tasks.service.ts applies them. Explained in docs/code/tasks.md.
 */
import type { Role } from '@prisma/client';

/**
 * Smallest gap allowed between two neighbouring ranks in a column.
 * Cards are ordered by a float `rank`; dropping a card between A and B gives it (A+B)/2, so inserting
 * repeatedly in the same spot halves the gap each time. Below this value the column is renumbered 1..n.
 * Chosen far above double precision (~1e-16 relative) so ordering never becomes ambiguous.
 */
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

/** Only OWNER, ADMIN, or the reporter can delete a task. */
export function canDeleteTask(role: Role, userId: string, reporterId: string): boolean {
  return role === 'OWNER' || role === 'ADMIN' || userId === reporterId;
}

/** True when two adjacent ranks are too close and column needs rebalancing. */
export function needsRebalance(a: number, b: number): boolean {
  return Math.abs(a - b) < RANK_GAP_MIN;
}
