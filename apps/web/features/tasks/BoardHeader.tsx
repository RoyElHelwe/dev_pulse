'use client';

/**
 * Top header bar of the task board containing title, project prefix, filters, and actions.
 * Used by TaskBoard to organize board navigation and filtering.
 */

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { BoardFilters } from './BoardFilters';
import type { BoardFilter, BoardMember } from './types';

export interface BoardHeaderProps {
  prefix: string;
  members: BoardMember[];
  filter: BoardFilter;
  onFilterChange(f: BoardFilter): void;
  myId: string;
  taskCount: number;
  shownCount: number;
  onCreate(): void;
  onClose(): void;
}

/** Renders the board toolbar with search, assignee filters, and create/close buttons. */
export function BoardHeader({
  prefix,
  members,
  filter,
  onFilterChange,
  myId,
  taskCount,
  shownCount,
  onCreate,
  onClose,
}: BoardHeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-zinc-200/80 px-4 py-2.5 shrink-0">
      <div className="flex items-center gap-2 shrink-0">
        <h2 className="text-base font-semibold text-zinc-900">Board</h2>
        {prefix && (
          <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 font-mono text-xs font-medium text-zinc-600">
            {prefix}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <BoardFilters
          members={members}
          filter={filter}
          onChange={onFilterChange}
          myId={myId}
          taskCount={taskCount}
          shownCount={shownCount}
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button variant="primary" size="sm" onClick={onCreate}>
          <Plus className="size-4" />
          <span>Create</span>
        </Button>
        <IconButton aria-label="Close board" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>
    </header>
  );
}
