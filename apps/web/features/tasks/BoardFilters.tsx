'use client';

/**
 * Filter toolbar providing text search, quick assignee faces, only-mine toggle, and reset actions.
 * Embedded inside BoardHeader above the task lanes.
 */

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BoardFilterFaces } from './BoardFilterFaces';
import { PeoplePicker } from './PeoplePicker';
import {
  EMPTY_FILTER,
  MAX_VISIBLE_MEMBERS,
  compareMembers,
  isFiltered,
  matchesFilter,
  pickVisibleMembers,
} from './boardFilterUtils';
import { countOpenTasks, useTasks } from './taskStore';
import type { BoardFilter, BoardMember } from './types';

export { EMPTY_FILTER, isFiltered, matchesFilter, compareMembers };

/** Filter criteria, member options, result counts, and change handler for controlling board search and filtering. */
export interface BoardFiltersProps {
  members: BoardMember[];
  filter: BoardFilter;
  onChange(f: BoardFilter): void;
  myId: string;
  taskCount: number;
  shownCount: number;
  openCounts?: Map<string, number>;
}

/** Renders search input, member face pills, and preset filters for task filtering. */
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
    () => pickVisibleMembers(members, filter.assignees, myId, effectiveOpenCounts, MAX_VISIBLE_MEMBERS),
    [members, filter.assignees, myId, effectiveOpenCounts],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const showPlus = members.length > MAX_VISIBLE_MEMBERS;
  const badgeCount = members.length - shownMembers.length;

  const toggleAssignee = (id: string) => {
    const assignees = filter.assignees.includes(id)
      ? filter.assignees.filter((x) => x !== id)
      : [...filter.assignees, id];
    onChange({ ...filter, assignees });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
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

      <BoardFilterFaces
        shownMembers={shownMembers}
        selectedAssignees={filter.assignees}
        onToggleAssignee={toggleAssignee}
        showPlus={showPlus}
        badgeCount={badgeCount}
        onOpenPicker={() => setPickerOpen(true)}
      />

      <PeoplePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        members={members}
        openCounts={effectiveOpenCounts}
        filter={filter}
        onChange={onChange}
        myId={myId}
      />

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
