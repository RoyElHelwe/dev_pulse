'use client';

import {
  Bookmark,
  Bug,
  Check,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  Equal,
  User,
} from 'lucide-react';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { cn } from '@/lib/cn';
import type { BoardMember, TaskPriority, TaskType } from './types';
import { PRIORITY_LABEL, TYPE_LABEL } from './types';

export function TypeIcon({ type, className }: { type: TaskType; className?: string }) {
  const label = TYPE_LABEL[type];

  let bg = 'bg-blue-600';
  let Icon = Check;

  if (type === 'BUG') {
    bg = 'bg-red-600';
    Icon = Bug;
  } else if (type === 'STORY') {
    bg = 'bg-emerald-600';
    Icon = Bookmark;
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-md',
        bg,
        className,
      )}
    >
      <Icon className="size-3 text-white" aria-hidden="true" />
    </span>
  );
}

export function PriorityIcon({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  const label = PRIORITY_LABEL[priority];

  let Icon = Equal;
  let color = 'text-amber-500';

  if (priority === 'HIGHEST') {
    Icon = ChevronsUp;
    color = 'text-red-600';
  } else if (priority === 'HIGH') {
    Icon = ChevronUp;
    color = 'text-orange-500';
  } else if (priority === 'MEDIUM') {
    Icon = Equal;
    color = 'text-amber-500';
  } else if (priority === 'LOW') {
    Icon = ChevronDown;
    color = 'text-blue-500';
  } else if (priority === 'LOWEST') {
    Icon = ChevronsDown;
    color = 'text-blue-400';
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('inline-flex size-4 shrink-0 items-center justify-center', color, className)}
    >
      <Icon className="size-full" aria-hidden="true" />
    </span>
  );
}

export function AssigneeAvatar({
  member,
  className,
}: {
  member?: BoardMember;
  className?: string;
}) {
  const hasSize = className && /\b(size|w|h)-/.test(className);
  const hasRingColor = className && /\bring-(emerald|zinc|white|red|blue|amber|gray)/.test(className);

  if (member) {
    return (
      <div
        title={member.displayName}
        aria-label={member.displayName}
        className={cn(
          'shrink-0 rounded-full overflow-hidden ring-2',
          !hasRingColor && 'ring-white',
          !hasSize && 'size-6',
          className,
        )}
      >
        <CharacterFace character={member.character} className="size-full" />
      </div>
    );
  }

  return (
    <div
      title="Unassigned"
      aria-label="Unassigned"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 ring-2 overflow-hidden',
        !hasRingColor && 'ring-white',
        !hasSize && 'size-6',
        className,
      )}
    >
      <User className="size-3.5" aria-hidden="true" />
    </div>
  );
}
