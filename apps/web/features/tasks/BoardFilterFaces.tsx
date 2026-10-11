'use client';

/**
 * Avatar row for quickly toggling filters by individual workspace members or unassigned tasks.
 * Rendered within BoardFilters alongside search and preset buttons.
 */

import { Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AssigneeAvatar } from './TaskIcons';
import type { BoardMember } from './types';

/** Visible member avatars, active assignee selections, and overflow trigger state for filtering board tasks. */
export interface BoardFilterFacesProps {
  shownMembers: BoardMember[];
  selectedAssignees: string[];
  onToggleAssignee(id: string): void;
  showPlus: boolean;
  badgeCount: number;
  onOpenPicker(): void;
}

/** Renders the cluster of member avatar filter buttons with overflow badge. */
export function BoardFilterFaces({
  shownMembers,
  selectedAssignees,
  onToggleAssignee,
  showPlus,
  badgeCount,
  onOpenPicker,
}: BoardFilterFacesProps) {
  const isNoneSelected = selectedAssignees.includes('none');

  return (
    <div
      role="group"
      aria-label="Filter by user"
      data-testid="filter-faces"
      className="flex items-center -space-x-1.5 py-1 px-0.5"
    >
      {shownMembers.map((member) => {
        const isSelected = selectedAssignees.includes(member.userId);
        return (
          <button
            key={member.userId}
            type="button"
            aria-pressed={isSelected}
            aria-label={`Filter by ${member.displayName}`}
            title={member.displayName}
            onClick={() => onToggleAssignee(member.userId)}
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
        onClick={() => onToggleAssignee('none')}
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
          onClick={onOpenPicker}
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
  );
}
