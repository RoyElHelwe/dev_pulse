'use client';

/**
 * Hook managing board drag-and-drop state, column position caching, and rank calculations.
 * Used by TaskBoard to reorder and move tasks between status columns.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { taskActions } from './taskStore';
import type { BoardFilter, TaskStatus, TaskView } from './types';

interface ColumnMids {
  scroller: HTMLElement;
  mids: number[];
}

/**
 * Computes a midpoint rank between two tasks for fractional ordering
 * without needing to rewrite rankings across the entire column.
 */
function rankBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1;
  if (before === null) return after! - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
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

function computeInsertionIndex(
  container: HTMLElement,
  clientY: number,
  currentDragId: string | null,
): number {
  return insertionIndexAt(measureColumn(container, currentDragId), clientY);
}

/** Board tasks, status lane groups, filter state, and error callback for drag-and-drop state management. */
export interface UseBoardDragOptions {
  tasks: TaskView[];
  tasksByStatus: Record<TaskStatus, TaskView[]>;
  filter: BoardFilter;
  onError(message: string): void;
}

/** Coordinates drag gestures, hover insertion indicators, and task rank updates. */
export function useBoardDrag({
  tasks,
  tasksByStatus,
  filter,
  onError,
}: UseBoardDragOptions) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ status: TaskStatus; index: number } | null>(null);

  // Latest values for stable drag handlers so columns do not unnecessarily re-render.
  const live = useRef({ dragId, tasks, tasksByStatus });
  live.current = { dragId, tasks, tasksByStatus };

  // Card positions are cached per drag gesture to avoid forcing layout thrashing on every dragover.
  const columnCache = useRef(new Map<HTMLElement, ColumnMids>());
  const pendingOver = useRef<{ status: TaskStatus; y: number; el: HTMLElement } | null>(null);
  const overFrame = useRef(0);

  const cancelOver = useCallback(() => {
    cancelAnimationFrame(overFrame.current);
    overFrame.current = 0;
    pendingOver.current = null;
  }, []);

  useEffect(() => cancelOver, [cancelOver]);

  // Tasks changing under a drag (live updates) shifts cards: measure again.
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
    setDropTarget((prev) =>
      prev?.status === p.status && prev.index === index ? prev : { status: p.status, index },
    );
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
      const { dragId: draggedId, tasks: currentTasks, tasksByStatus: currentTasksByStatus } = live.current;
      const id = e.dataTransfer.getData('text/plain') || draggedId;
      const container = e.currentTarget;
      cancelOver();
      columnCache.current.clear();
      setDropTarget(null);
      setDragId(null);
      if (!id) return;

      const task = currentTasks.find((t) => t.id === id);
      if (!task) return;

      const columnCards = currentTasksByStatus[status];
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
        onError(message);
      }
    },
    [cancelOver, onError],
  );

  return {
    dragId,
    dropTarget,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDragEnd,
    handleDrop,
  };
}
