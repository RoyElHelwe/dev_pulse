'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import type { NewTask, TaskPatch, TaskStatus, TaskView } from './types';

// The workspace's tasks, shared by everything in the office (board, desk paper
// stacks...). `useTaskSync(socket)` keeps it loaded and live; the rest only reads.

interface State {
  prefix: string;
  tasks: TaskView[];
  loaded: boolean;
}

let state: State = { prefix: '', tasks: [], loaded: false };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function sorted(tasks: TaskView[]) {
  return tasks.slice().sort((a, b) => a.rank - b.rank || a.number - b.number);
}

function upsert(task: TaskView) {
  const exists = state.tasks.some((t) => t.id === task.id);
  set({ tasks: sorted(exists ? state.tasks.map((t) => (t.id === task.id ? task : t)) : [...state.tasks, task]) });
}

function remove(id: string) {
  if (state.tasks.some((t) => t.id === id)) set({ tasks: state.tasks.filter((t) => t.id !== id) });
}

async function load() {
  const res = await api<{ prefix: string; tasks: TaskView[] }>('/workspace/tasks');
  set({ prefix: res.prefix, tasks: sorted(res.tasks), loaded: true });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
const getSnapshot = () => state;
const SERVER_STATE: State = { prefix: '', tasks: [], loaded: false };
const getServerSnapshot = (): State => SERVER_STATE;

/** Mount once in the office: loads the tasks and applies `task:*` events live. */
export function useTaskSync(socket: Socket | null) {
  useEffect(() => {
    if (!socket) return;
    const reload = () => void load().catch(() => undefined);
    // Also on every reconnect (after a network loss): catch up on what was missed.
    const onConnect = reload;
    reload();
    socket.on('connect', onConnect);
    socket.on('task:created', upsert);
    socket.on('task:updated', upsert);
    socket.on('task:deleted', (e: { id: string }) => remove(e.id));
    return () => {
      socket.off('connect', onConnect);
      socket.off('task:created', upsert);
      socket.off('task:updated', upsert);
      socket.off('task:deleted');
      set({ prefix: '', tasks: [], loaded: false });
    };
  }, [socket]);
}

/** All tasks (sorted by rank), the key prefix and whether they have loaded. */
export function useTasks() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Open tasks (status is not DONE) per assignee id. */
export function countOpenTasks(tasks: TaskView[]) {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === 'DONE' || !t.assigneeId) continue;
    counts.set(t.assigneeId, (counts.get(t.assigneeId) ?? 0) + 1);
  }
  return counts;
}

/** Open-task count per user id (for the paper stacks on desks). */
export function useOpenTaskCounts() {
  const { tasks } = useTasks();
  return useMemo(() => countOpenTasks(tasks), [tasks]);
}

// ---- actions (the server echoes every change on the socket; the store also applies the response) ----

export const taskActions = {
  async create(input: NewTask) {
    const task = await api<TaskView>('/workspace/tasks', { method: 'POST', body: input });
    upsert(task);
    return task;
  },

  async update(id: string, patch: TaskPatch) {
    const task = await api<TaskView>(`/workspace/tasks/${id}`, { method: 'PATCH', body: patch });
    upsert(task);
    return task;
  },

  /**
   * Move a card: optimistic (the card jumps at once), rolled back if refused.
   * `rank` omitted + new status = end of that column.
   */
  async move(id: string, status: TaskStatus, rank?: number) {
    const before = state.tasks.find((t) => t.id === id);
    if (!before) return;
    upsert({ ...before, status, rank: rank ?? Math.max(0, ...state.tasks.map((t) => t.rank)) + 1 });
    try {
      await taskActions.update(id, rank === undefined ? { status } : { status, rank });
    } catch (err) {
      upsert(before);
      throw err;
    }
  },

  async remove(id: string) {
    await api(`/workspace/tasks/${id}`, { method: 'DELETE' });
    remove(id);
  },
};
