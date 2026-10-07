'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, X } from 'lucide-react';
import { useEscape } from '@/lib/escape';
import { cn } from '@/lib/cn';
import { compareMembers } from './BoardFilters';
import { AssigneeAvatar } from './TaskIcons';
import type { BoardFilter, BoardMember } from './types';

export interface PeoplePickerProps {
  open: boolean;
  onClose(): void;
  members: BoardMember[];
  openCounts: Map<string, number>;
  filter: BoardFilter;
  onChange(f: BoardFilter): void;
  myId?: string;
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
        rootMargin: '100px 0px',
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

function formatRole(role: 'OWNER' | 'ADMIN' | 'MEMBER'): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

type PickerItem =
  | { kind: 'unassigned'; id: 'none'; label: string; count: number }
  | { kind: 'member'; id: string; label: string; member: BoardMember; count: number };

export function PeoplePicker({
  open,
  onClose,
  members,
  openCounts,
  filter,
  onChange,
  myId = '',
}: PeoplePickerProps) {
  useEscape(open, onClose);

  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setDebouncedQuery('');
      setActiveIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const normalized = debouncedQuery.trim().toLowerCase();
  const unassignedMatches = !normalized || 'unassigned'.includes(normalized);

  const matchingMembers = useMemo(() => {
    const sorted = [...members].sort((a, b) => compareMembers(a, b, myId, openCounts));
    if (!normalized) return sorted;
    return sorted.filter((m) => {
      const nameMatch = m.displayName.toLowerCase().includes(normalized);
      const emailMatch = m.email ? m.email.toLowerCase().includes(normalized) : false;
      return nameMatch || emailMatch;
    });
  }, [members, myId, openCounts, normalized]);

  const items: PickerItem[] = useMemo(() => {
    const res: PickerItem[] = [];
    if (unassignedMatches) {
      res.push({
        kind: 'unassigned',
        id: 'none',
        label: 'Unassigned',
        count: openCounts.get('none') ?? 0,
      });
    }
    for (const m of matchingMembers) {
      res.push({
        kind: 'member',
        id: m.userId,
        label: m.displayName,
        member: m,
        count: openCounts.get(m.userId) ?? 0,
      });
    }
    return res;
  }, [unassignedMatches, matchingMembers, openCounts]);

  const isLazy = items.length > 50;

  useEffect(() => {
    setActiveIndex((prev) => {
      if (items.length === 0) return 0;
      if (prev >= items.length) return items.length - 1;
      return prev;
    });
  }, [items.length]);

  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const toggleAssignee = (id: string) => {
    const assignees = filter.assignees.includes(id)
      ? filter.assignees.filter((x) => x !== id)
      : [...filter.assignees, id];
    onChange({ ...filter, assignees });
  };

  const handleClear = () => {
    onChange({ ...filter, assignees: [] });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (items.length > 0 ? Math.min(items.length - 1, prev + 1) : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (items.length > 0 ? Math.max(0, prev - 1) : 0));
    } else if (e.key === 'Enter') {
      if (items.length > 0 && activeIndex >= 0 && activeIndex < items.length) {
        e.preventDefault();
        toggleAssignee(items[activeIndex].id);
      }
    }
  };

  if (!open || !mounted) return null;

  const activeItemId = items[activeIndex] ? `${baseId}-item-${items[activeIndex].id}` : undefined;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find people"
        data-testid="people-picker"
        tabIndex={-1}
        data-captures-keys=""
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 outline-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">Find people</h3>
            {filter.assignees.length > 0 && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                {filter.assignees.length} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Clear selection"
              onClick={handleClear}
              disabled={filter.assignees.length === 0}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded px-1"
            >
              Clear
            </button>
            <div className="h-3.5 w-px bg-zinc-200" aria-hidden="true" />
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Done
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="border-b border-zinc-100 px-4 py-2.5">
          <div className="relative flex items-center">
            <Search
              className="pointer-events-none absolute left-3 size-4 text-zinc-400"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              aria-activedescendant={activeItemId}
              className="h-9 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-8 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 rounded p-0.5 text-zinc-400 hover:text-zinc-600 focus:outline-none"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div
          ref={listRef}
          role="listbox"
          aria-label="People"
          className="max-h-80 overflow-y-auto divide-y divide-zinc-50 py-1"
        >
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No people match
            </div>
          ) : (
            items.map((item, index) => {
              const isSelected = filter.assignees.includes(item.id);
              const isActive = index === activeIndex;

              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  id={`${baseId}-item-${item.id}`}
                  type="button"
                  role="option"
                  data-testid="people-picker-row"
                  aria-selected={isSelected}
                  data-active={isActive ? 'true' : undefined}
                  onClick={() => toggleAssignee(item.id)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2 text-left transition select-none focus:outline-none',
                    isActive ? 'bg-zinc-100' : 'hover:bg-zinc-50',
                  )}
                >
                  <LazyFace
                    member={item.kind === 'member' ? item.member : undefined}
                    lazy={isLazy}
                    containerRef={listRef}
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
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
