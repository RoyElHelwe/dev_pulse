'use client';

import { memo, type ComponentProps, type KeyboardEvent, type MouseEvent } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AssigneeAvatar, PriorityIcon, TypeIcon } from './TaskIcons';
import type { BoardMember, TaskView } from './types';

export interface TaskCardProps
  extends Omit<ComponentProps<'div'>, 'onClick' | 'children'> {
  task: TaskView;
  assignee?: BoardMember;
  onOpen(): void;
  dragging?: boolean;
}

/**
 * Re-renders only when its data changes. The callbacks are per-card closures made by the column, but they only
 * capture the task id and stable column handlers, so they are deliberately left out of the comparison.
 */
export const TaskCard = memo(function TaskCard({
  task,
  assignee,
  onOpen,
  dragging,
  className,
  ...rest
}: TaskCardProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      onOpen();
    } else if (e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
    rest.onKeyDown?.(e);
  };

  const handleClick = (_e: MouseEvent<HTMLDivElement>) => {
    onOpen();
  };

  let formattedDueDate: string | null = null;
  let isOverdue = false;
  if (task.dueDate) {
    const d = new Date(task.dueDate);
    if (!Number.isNaN(d.getTime())) {
      formattedDueDate = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
      isOverdue = task.status !== 'DONE' && d.getTime() < Date.now();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-task-id={task.id}
      {...rest}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex flex-col justify-between rounded-lg border border-zinc-200 bg-white p-2.5 shadow-sm hover:bg-zinc-50 cursor-grab select-none transition-opacity',
        dragging && 'opacity-40',
        className,
      )}
    >
      <div className="text-sm text-zinc-900 line-clamp-3 break-words">
        {task.title}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-xs">
        <TypeIcon type={task.type} />
        <span
          className={cn(
            'text-xs text-zinc-500',
            task.status === 'DONE' && 'line-through',
          )}
        >
          {task.key}
        </span>
        {formattedDueDate && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
              isOverdue
                ? 'bg-red-50 text-red-600 font-medium'
                : 'bg-zinc-100 text-zinc-500',
            )}
          >
            <Calendar className="size-3 shrink-0" aria-hidden="true" />
            <span>{formattedDueDate}</span>
          </span>
        )}
        <div className="flex-1" />
        <PriorityIcon priority={task.priority} />
        <AssigneeAvatar member={assignee} />
      </div>
    </div>
  );
}, (a, b) => a.task === b.task && a.assignee === b.assignee && a.dragging === b.dragging && a.className === b.className);
