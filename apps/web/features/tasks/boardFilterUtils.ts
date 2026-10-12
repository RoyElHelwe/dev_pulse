/**
 * Filter matching, ordering, and member visibility helpers for the task board.
 * Used by BoardFilters, TaskBoard, and PeoplePicker.
 */

import type { BoardFilter, BoardMember, TaskView } from './types';

/** Maximum number of member avatar buttons shown directly in the filter toolbar before overflowing. */
export const MAX_VISIBLE_MEMBERS = 8;

/** Inactive filter baseline with empty search text, no assignee restrictions, and all tasks shown. */
export const EMPTY_FILTER: BoardFilter = {
  assignees: [],
  onlyMine: false,
  query: '',
};

/** Determines whether any filter criteria (query, assignee, or ownership) are currently active. */
export function isFiltered(f: BoardFilter): boolean {
  return f.onlyMine || f.assignees.length > 0 || f.query.trim().length > 0;
}

/** Evaluates whether a given task satisfies current active board filter criteria. */
export function matchesFilter(task: TaskView, f: BoardFilter, myId: string): boolean {
  if (f.onlyMine && task.assigneeId !== myId) {
    return false;
  }

  if (f.assignees.length > 0) {
    const matchesAssignee =
      task.assigneeId === null
        ? f.assignees.includes('none')
        : f.assignees.includes(task.assigneeId);
    if (!matchesAssignee) {
      return false;
    }
  }

  const trimmedQuery = f.query.trim().toLowerCase();
  if (trimmedQuery.length > 0) {
    const matchesKey = task.key.toLowerCase().includes(trimmedQuery);
    const matchesTitle = task.title.toLowerCase().includes(trimmedQuery);
    if (!matchesKey && !matchesTitle) {
      return false;
    }
  }

  return true;
}

/** Sorts members by current user first, then by open task count descending, then display name. */
export function compareMembers(
  a: BoardMember,
  b: BoardMember,
  myId: string,
  openCounts: Map<string, number>,
): number {
  const aMe = a.userId === myId ? 1 : 0;
  const bMe = b.userId === myId ? 1 : 0;
  if (aMe !== bMe) return bMe - aMe;

  const aCount = openCounts.get(a.userId) ?? 0;
  const bCount = openCounts.get(b.userId) ?? 0;
  if (aCount !== bCount) return bCount - aCount;

  return a.displayName.localeCompare(b.displayName);
}

/** Picks the top workspace members to display in the quick-filter avatar bar. */
export function pickVisibleMembers(
  members: BoardMember[],
  selectedIds: string[],
  myId: string,
  openCounts: Map<string, number>,
  max = MAX_VISIBLE_MEMBERS,
): BoardMember[] {
  const selectedSet = new Set(selectedIds);
  return [...members]
    .sort((a, b) => {
      const aSel = selectedSet.has(a.userId) ? 1 : 0;
      const bSel = selectedSet.has(b.userId) ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel;

      return compareMembers(a, b, myId, openCounts);
    })
    .slice(0, max);
}
