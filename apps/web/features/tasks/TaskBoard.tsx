'use client';

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useEscape } from '@/lib/escape';
import { BoardFilters, isFiltered, matchesFilter } from './BoardFilters';
import { taskActions, useTasks } from './store';
import { TaskCard } from './TaskCard';
import { TaskDialog } from './TaskDialog';
import type { BoardFilter, BoardMember, TaskStatus, TaskView } from './types';
import { STATUSES, STATUS_LABEL } from './types';
import { useBoardMembers } from './useBoardMembers';

type DialogMode =
  | { kind: 'create'; status?: TaskStatus; assigneeId?: string | null }
  | { kind: 'edit'; taskId: string };

function rankBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1;
  if (before === null) return after! - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}

/** Card midpoints of one column in its scroller's content coordinates (so they survive scrolling). */
interface ColumnMids {
  scroller: HTMLElement;
  mids: number[];
}

function measureColumn(container: HTMLElement, currentDragId: string | null): ColumnMids {
  const scroller = container.querySelector<HTMLElement>('[data-column-scroll]') ?? container;
  const origin = scroller.getBoundingClientRect().top - scroller.scrollTop;
  const mids = Array.from(container.querySelectorAll<HTMLElement>('[data-task-id]'))
    .filter((el) => el.getAttribute('data-task-id') !== currentDragId)
    .map((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top + rect.height / 2 - origin;
    });
  return { scroller, mids };
}

function insertionIndexAt({ scroller, mids }: ColumnMids, clientY: number): number {
  const y = clientY - (scroller.getBoundingClientRect().top - scroller.scrollTop);
  for (let i = 0; i < mids.length; i++) {
    if (y < mids[i]) return i;
  }
  return mids.length;
}

function computeInsertionIndex(container: HTMLElement, clientY: number, currentDragId: string | null): number {
  return insertionIndexAt(measureColumn(container, currentDragId), clientY);
}

function InsertionLine() {
  return <div className="h-0.5 w-full shrink-0 rounded-full bg-emerald-500 transition-all" />;
}

interface ColumnProps {
  status: TaskStatus;
  cards: TaskView[];
  totalCount: number;
  filtered: boolean;
  onlyMine: boolean;
  myId: string;
  memberMap: Map<string, BoardMember>;
  dragId: string | null;
  /** Where the drop line goes in THIS column while it is hovered, otherwise null. */
  dropIndex: number | null;
  onOpenTask(id: string): void;
  onCreate(mode: DialogMode): void;
  onDragStart(id: string): void;
  onDragEnd(): void;
  onDragOver(e: React.DragEvent<HTMLElement>, status: TaskStatus): void;
  onDragLeave(e: React.DragEvent<HTMLElement>, status: TaskStatus): void;
  onDrop(e: React.DragEvent<HTMLElement>, status: TaskStatus): void;
}

const Column = memo(function Column({
  status,
  cards,
  totalCount,
  filtered,
  onlyMine,
  myId,
  memberMap,
  dragId,
  dropIndex,
  onOpenTask,
  onCreate,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: ColumnProps) {
  const isHovered = dropIndex !== null;
  const visibleCards = cards.filter((c) => c.id !== dragId);

  return (
    <div
      className={cn(
        'flex flex-col min-w-64 shrink-0 @3xl:shrink @3xl:min-w-0 flex-1 rounded-xl bg-zinc-100/80 border border-zinc-200/50 min-h-0 transition-shadow',
        isHovered && 'ring-2 ring-emerald-400/60',
      )}
      onDragOver={(e) => onDragOver(e, status)}
      onDragLeave={(e) => onDragLeave(e, status)}
      onDrop={(e) => onDrop(e, status)}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {STATUS_LABEL[status]}
        </span>
        <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-xs font-medium text-zinc-600">
          {filtered ? `${cards.length} of ${totalCount}` : totalCount}
        </span>
      </div>

      <div data-column-scroll="" className="flex-1 overflow-y-auto px-2 py-1 min-h-0 space-y-2">
        {cards.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center p-4 gap-2 text-xs font-medium text-zinc-400">
            {isHovered && <InsertionLine />}
            <span>{dragId ? 'Drop here' : 'No issues'}</span>
          </div>
        ) : (
          <>
            {cards.map((task) => {
              const isDragged = task.id === dragId;
              const visibleIdx = visibleCards.indexOf(task);
              const showLineBefore = isHovered && !isDragged && dropIndex === visibleIdx;

              return (
                <Fragment key={task.id}>
                  {showLineBefore && <InsertionLine />}
                  <TaskCard
                    task={task}
                    assignee={task.assigneeId ? memberMap.get(task.assigneeId) : undefined}
                    onOpen={() => onOpenTask(task.id)}
                    dragging={isDragged}
                    draggable
                    data-task-id={task.id}
                    onDragStart={(e: React.DragEvent) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', task.id);
                      onDragStart(task.id);
                    }}
                    onDragEnd={onDragEnd}
                  />
                </Fragment>
              );
            })}
            {isHovered && dropIndex === visibleCards.length && <InsertionLine />}
          </>
        )}
      </div>

      <div className="p-2 pt-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs text-zinc-500 hover:text-zinc-900"
          onClick={() =>
            onCreate({
              kind: 'create',
              status,
              assigneeId: onlyMine ? myId : undefined,
            })
          }
        >
          <Plus className="size-3.5" />
          <span>Create</span>
        </Button>
      </div>
    </div>
  );
});

interface HeaderProps {
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

function Header({
  prefix,
  members,
  filter,
  onFilterChange,
  myId,
  taskCount,
  shownCount,
  onCreate,
  onClose,
}: HeaderProps) {
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

export function TaskBoard({
  open,
  onClose,
  filter,
  onFilterChange,
  myId,
  role,
}: {
  open: boolean;
  onClose(): void;
  filter: BoardFilter;
  onFilterChange(f: BoardFilter): void;
  myId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}) {
  useEscape(open, onClose);

  const members = useBoardMembers(open);
  const { prefix, tasks, loaded } = useTasks();

  const boardRef = useRef<HTMLDivElement>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ status: TaskStatus; index: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDialogMode(null);
      return;
    }
    const timer = setTimeout(() => {
      boardRef.current?.focus({ preventScroll: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const memberMap = useMemo(() => {
    const map = new Map<string, BoardMember>();
    for (const m of members) {
      map.set(m.userId, m);
    }
    return map;
  }, [members]);

  const visibleTasks = useMemo(
    () => tasks.filter((t) => matchesFilter(t, filter, myId)),
    [tasks, filter, myId],
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, TaskView[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };
    for (const task of visibleTasks) {
      if (map[task.status]) {
        map[task.status].push(task);
      }
    }
    return map;
  }, [visibleTasks]);

  const totalCountsByStatus = useMemo(() => {
    const map: Record<TaskStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };
    for (const task of tasks) {
      if (map[task.status] !== undefined) {
        map[task.status]++;
      }
    }
    return map;
  }, [tasks]);

  // Latest values for the (stable) drag handlers below, so the columns don't re-render for them.
  const live = useRef({ dragId, tasks, tasksByStatus });
  live.current = { dragId, tasks, tasksByStatus };
  const openTask = useCallback((id: string) => setDialogMode({ kind: 'edit', taskId: id }), []);

  // Card positions are measured once per column per drag (not on every dragover), and the hover
  // state is updated at most once per frame.
  const columnCache = useRef(new Map<HTMLElement, ColumnMids>());
  const pendingOver = useRef<{ status: TaskStatus; y: number; el: HTMLElement } | null>(null);
  const overFrame = useRef(0);
  const cancelOver = useCallback(() => {
    cancelAnimationFrame(overFrame.current);
    overFrame.current = 0;
    pendingOver.current = null;
  }, []);
  useEffect(() => cancelOver, [cancelOver]);
  // Tasks changing under a drag (live updates) moves the cards: measure again.
  useEffect(() => columnCache.current.clear(), [tasks, filter]);

  const flushOver = useCallback(() => {
    overFrame.current = 0;
    const p = pendingOver.current;
    pendingOver.current = null;
    if (!p) return;
    let cols = columnCache.current.get(p.el);
    if (!cols) {
      cols = measureColumn(p.el, live.current.dragId);
      columnCache.current.set(p.el, cols);
    }
    const index = insertionIndexAt(cols, p.y);
    setDropTarget((prev) => (prev?.status === p.status && prev.index === index ? prev : { status: p.status, index }));
  }, []);

  const handleDragStart = useCallback((id: string) => {
    columnCache.current.clear();
    setDragId(id);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLElement>, status: TaskStatus) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      pendingOver.current = { status, y: e.clientY, el: e.currentTarget };
      if (!overFrame.current) overFrame.current = requestAnimationFrame(flushOver);
    },
    [flushOver],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLElement>, status: TaskStatus) => {
      if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
      if (pendingOver.current?.status === status) cancelOver();
      setDropTarget((prev) => (prev?.status === status ? null : prev));
    },
    [cancelOver],
  );

  const handleDragEnd = useCallback(() => {
    cancelOver();
    columnCache.current.clear();
    setDragId(null);
    setDropTarget(null);
  }, [cancelOver]);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLElement>, status: TaskStatus) => {
      e.preventDefault();
      const { dragId: draggedId, tasks, tasksByStatus } = live.current;
      const id = e.dataTransfer.getData('text/plain') || draggedId;
      const container = e.currentTarget;
      cancelOver();
      columnCache.current.clear();
      setDropTarget(null);
      setDragId(null);
      if (!id) return;

      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      const columnCards = tasksByStatus[status];
      const visibleCards = columnCards.filter((c) => c.id !== id);
      const insertIndex = computeInsertionIndex(container, e.clientY, id);

      const originalIndex = columnCards.findIndex((c) => c.id === id);
      if (task.status === status && originalIndex !== -1 && originalIndex === insertIndex) {
        return;
      }

      const before = insertIndex > 0 ? visibleCards[insertIndex - 1] : null;
      const after = insertIndex < visibleCards.length ? visibleCards[insertIndex] : null;
      const rank = rankBetween(before ? before.rank : null, after ? after.rank : null);

      try {
        await taskActions.move(id, status, rank);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to move task';
        setError(message);
      }
    },
    [cancelOver],
  );

  return (
    <>
      <div
            ref={boardRef}
            role="region"
            aria-label="Task board"
            tabIndex={-1}
            data-captures-keys=""
            className="@container flex h-full flex-col outline-none"
          >
            <Header
              prefix={prefix}
              members={members}
              filter={filter}
              onFilterChange={onFilterChange}
              myId={myId}
              taskCount={tasks.length}
              shownCount={visibleTasks.length}
              onCreate={() =>
                setDialogMode({
                  kind: 'create',
                  assigneeId: filter.onlyMine ? myId : undefined,
                })
              }
              onClose={onClose}
            />

            {error && (
              <div
                role="alert"
                className="flex shrink-0 items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-800"
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="rounded p-0.5 text-red-600 hover:bg-red-100 hover:text-red-900 focus-visible:outline-2 focus-visible:outline-red-500"
                  aria-label="Dismiss error"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {!loaded ? (
              <div className="flex flex-1 items-center justify-center text-sm font-medium text-zinc-500">
                Loading issues...
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-4 @3xl:grid @3xl:grid-cols-4">
                {STATUSES.map((status) => (
                  <Column
                    key={status}
                    status={status}
                    cards={tasksByStatus[status]}
                    totalCount={totalCountsByStatus[status]}
                    filtered={isFiltered(filter)}
                    onlyMine={filter.onlyMine}
                    myId={myId}
                    memberMap={memberMap}
                    dragId={dragId}
                    dropIndex={dropTarget?.status === status ? dropTarget.index : null}
                    onOpenTask={openTask}
                    onCreate={setDialogMode}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  />
                ))}
              </div>
            )}
      </div>

      {dialogMode && (
        <TaskDialog
          mode={dialogMode}
          members={members}
          myId={myId}
          role={role}
          onClose={() => setDialogMode(null)}
        />
      )}
    </>
  );
}
