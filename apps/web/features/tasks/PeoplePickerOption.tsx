'use client';

/**
 * Single selectable option row within the people picker list.
 * Rendered by PeoplePickerList with avatar, role badge, open task count, and selection checkmark.
 */

import { useEffect, useRef, useState, type Ref } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AssigneeAvatar } from './TaskIcons';
import type { BoardMember } from './types';

const INTERSECTION_ROOT_MARGIN = '100px 0px';

export type PickerItem =
  | { kind: 'unassigned'; id: 'none'; label: string; count: number }
  | { kind: 'member'; id: string; label: string; member: BoardMember; count: number };

function formatRole(role: 'OWNER' | 'ADMIN' | 'MEMBER'): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function LazyFace({
  member,
  lazy,
  containerRef,
}: {
  member?: BoardMember;
  lazy: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [visible, setVisible] = useState(!lazy);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lazy || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const target = elRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      {
        root: containerRef.current,
        rootMargin: INTERSECTION_ROOT_MARGIN,
      },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [lazy, visible, containerRef]);

  if (!visible) {
    return (
      <div
        ref={elRef}
        className="size-7 shrink-0 rounded-full bg-zinc-200"
        aria-hidden="true"
      />
    );
  }

  return <AssigneeAvatar member={member} className="size-7" />;
}

export interface PeoplePickerOptionProps {
  id: string;
  item: PickerItem;
  isSelected: boolean;
  isActive: boolean;
  lazy: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  buttonRef: Ref<HTMLButtonElement>;
  onSelect(): void;
  onHover(): void;
}

/** Renders an accessible listbox option row with avatar and member details. */
export function PeoplePickerOption({
  id,
  item,
  isSelected,
  isActive,
  lazy,
  containerRef,
  buttonRef,
  onSelect,
  onHover,
}: PeoplePickerOptionProps) {
  return (
    <button
      id={id}
      ref={buttonRef}
      type="button"
      role="option"
      data-testid="people-picker-row"
      aria-selected={isSelected}
      data-active={isActive ? 'true' : undefined}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-2 text-left transition select-none focus:outline-none',
        isActive ? 'bg-zinc-100' : 'hover:bg-zinc-50',
      )}
    >
      <LazyFace
        member={item.kind === 'member' ? item.member : undefined}
        lazy={lazy}
        containerRef={containerRef}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-zinc-900">
            {item.label}
          </span>
          {item.kind === 'member' && (
            <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
              {formatRole(item.member.role)}
            </span>
          )}
        </div>
        {item.kind === 'member' && item.member.email && (
          <span className="block truncate text-[11px] text-zinc-400">
            {item.member.email}
          </span>
        )}
      </div>

      <span className="shrink-0 text-xs text-zinc-400">
        {item.count} open
      </span>

      <div className="flex size-4 shrink-0 items-center justify-center">
        {isSelected && (
          <Check className="size-4 text-emerald-600" aria-hidden="true" />
        )}
      </div>
    </button>
  );
}
