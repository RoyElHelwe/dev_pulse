'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PeoplePicker } from './PeoplePicker';
import { countOpenTasks, useTasks } from './store';
import { AssigneeAvatar } from './TaskIcons';
import type { BoardFilter, BoardMember, TaskView } from './types';

export const EMPTY_FILTER: BoardFilter = {
  assignees: [],
  onlyMine: false,
  query: '',
};

export function isFiltered(f: BoardFilter): boolean {
  return f.onlyMine || f.assignees.length > 0 || f.query.trim().length > 0;
}

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

export function pickVisibleMembers(
  members: BoardMember[],
  selectedIds: string[],
  myId: string,
  openCounts: Map<string, number>,
  max = 8,
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

export interface BoardFiltersProps {
  members: BoardMember[];
  filter: BoardFilter;
  onChange(f: BoardFilter): void;
  myId: string;
  taskCount: number;
  shownCount: number;
  openCounts?: Map<string, number>;
}

export function BoardFilters({
  members,
  filter,
  onChange,
  myId,
  taskCount,
  shownCount,
  openCounts: propOpenCounts,
}: BoardFiltersProps) {
  const { tasks } = useTasks();
  const computedOpenCounts = useMemo(() => {
    const counts = countOpenTasks(tasks);
    let unassigned = 0;
    for (const t of tasks) {
      if (t.status !== 'DONE' && !t.assigneeId) {
        unassigned++;
      }
    }
    counts.set('none', unassigned);
    return counts;
  }, [tasks]);

  const effectiveOpenCounts = propOpenCounts ?? computedOpenCounts;

  const shownMembers = useMemo(
    () => pickVisibleMembers(members, filter.assignees, myId, effectiveOpenCounts, 8),
    [members, filter.assignees, myId, effectiveOpenCounts],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const showPlus = members.length > 8;
  const badgeCount = members.length - shownMembers.length;

  const toggleAssignee = (id: string) => {
    const assignees = filter.assignees.includes(id)
      ? filter.assignees.filter((x) => x !== id)
      : [...filter.assignees, id];
    onChange({ ...filter, assignees });
  };

  const isNoneSelected = filter.assignees.includes('none');

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search input */}
      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-2.5 size-4 text-zinc-400"
          aria-hidden="true"
        />
        <input
          type="text"
          value={filter.query}
          onChange={(e) => onChange({ ...filter, query: e.target.value })}
          placeholder="Search board"
          aria-label="Search board"
          className="h-8 rounded-full border border-zinc-200 bg-zinc-50 pl-8 pr-7 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        {filter.query.length > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...filter, query: '' })}
            aria-label="Clear search"
            className="absolute right-2 rounded p-0.5 text-zinc-400 hover:text-zinc-600 focus:outline-none"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Avatar row */}
      <div
        role="group"
        aria-label="Filter by user"
        data-testid="filter-faces"
        className="flex items-center -space-x-1.5 py-1 px-0.5"
      >
        {shownMembers.map((member) => {
          const isSelected = filter.assignees.includes(member.userId);
          return (
            <button
              key={member.userId}
              type="button"
              aria-pressed={isSelected}
              aria-label={`Filter by ${member.displayName}`}
              title={member.displayName}
              onClick={() => toggleAssignee(member.userId)}
              className={cn(
                'relative rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                isSelected
                  ? 'z-10 ring-2 ring-emerald-500 opacity-100'
                  : 'z-0 opacity-70 hover:opacity-100',
              )}
            >
              <AssigneeAvatar member={member} />
            </button>
          );
        })}

        <button
          type="button"
          aria-pressed={isNoneSelected}
          aria-label="Filter by Unassigned"
          title="Unassigned"
          onClick={() => toggleAssignee('none')}
          className={cn(
            'relative rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
            isNoneSelected
              ? 'z-10 ring-2 ring-emerald-500 opacity-100'
              : 'z-0 opacity-70 hover:opacity-100',
          )}
        >
          <AssigneeAvatar />
        </button>

        {showPlus && (
          <button
            type="button"
            aria-label="Find more people"
            title="Find more people"
            onClick={() => setPickerOpen(true)}
            className="relative z-0 flex size-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 ring-2 ring-white transition hover:bg-zinc-200 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {badgeCount > 0 && (
              <span
                className="absolute -top-1 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-zinc-700 px-0.5 text-[9px] font-bold text-white shadow-xs leading-none"
                aria-hidden="true"
              >
                +{badgeCount}
              </span>
            )}
          </button>
        )}
      </div>

      <PeoplePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        members={members}
        openCounts={effectiveOpenCounts}
        filter={filter}
        onChange={onChange}
        myId={myId}
      />

      {/* Only my issues toggle chip */}
      <button
        type="button"
        aria-pressed={filter.onlyMine}
        onClick={() => onChange({ ...filter, onlyMine: !filter.onlyMine })}
        className={cn(
          'inline-flex items-center h-8 rounded-full border px-3 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
          filter.onlyMine
            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50',
        )}
      >
        Only my issues
      </button>

      {/* Clear filters and count */}
      {isFiltered(filter) && (
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTER)}
            className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
          >
            Clear filters
          </button>
          <span className="text-zinc-400">
            {shownCount} of {taskCount} issues
          </span>
        </div>
      )}
    </div>
  );
}
