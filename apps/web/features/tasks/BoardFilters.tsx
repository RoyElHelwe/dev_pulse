'use client';

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
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

export interface BoardFiltersProps {
  members: BoardMember[];
  filter: BoardFilter;
  onChange(f: BoardFilter): void;
  myId: string;
  taskCount: number;
  shownCount: number;
}

export function BoardFilters({
  members,
  filter,
  onChange,
  myId,
  taskCount,
  shownCount,
}: BoardFiltersProps) {
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
        className="flex items-center -space-x-1.5 max-w-[40vw] overflow-x-auto py-1 px-0.5"
      >
        {members.map((member) => {
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
      </div>

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
