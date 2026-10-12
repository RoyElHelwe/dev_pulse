'use client';

/**
 * Kanban board displaying tasks organized across status columns with drag-and-drop reordering.
 * Primary feature view mounted within BoardDrawer.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useEscape } from '@/lib/escape';
import { BoardHeader } from './BoardHeader';
import { isFiltered, matchesFilter } from './BoardFilters';
import { TaskColumn } from './TaskColumn';
import { TaskDialog } from './TaskDialog';
import { useBoardDrag } from './useBoardDrag';
import { useTasks } from './taskStore';
import { useBoardMembers } from './useBoardMembers';
import type { BoardFilter, BoardMember, TaskStatus, TaskView } from './types';
import { STATUSES } from './types';

const FOCUS_DELAY_MS = 50;
const ERROR_TIMEOUT_MS = 5000;

type DialogMode =
  | { kind: 'create'; status?: TaskStatus; assigneeId?: string | null }
  | { kind: 'edit'; taskId: string };

/** Renders the full multi-column task board with filters, drag reordering, and edit dialogs. */
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDialogMode(null);
      return;
    }
    const timer = setTimeout(() => {
      boardRef.current?.focus({ preventScroll: true });
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError(null);
    }, ERROR_TIMEOUT_MS);
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

  const openTask = useCallback((id: string) => setDialogMode({ kind: 'edit', taskId: id }), []);

  const {
    dragId,
    dropTarget,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDragEnd,
    handleDrop,
  } = useBoardDrag({
    tasks,
    tasksByStatus,
    filter,
    onError: setError,
  });

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
        <BoardHeader
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
              <TaskColumn
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
