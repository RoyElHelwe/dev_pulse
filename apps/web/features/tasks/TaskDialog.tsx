'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Select } from '@/components/ui/Select';
import { ApiError } from '@/lib/api';
import { useEscape } from '@/lib/escape';
import { taskActions, useTasks } from './store';
import { AssigneeAvatar, PriorityIcon, TypeIcon } from './TaskIcons';
import type {
  BoardMember,
  TaskPatch,
  TaskPriority,
  TaskStatus,
  TaskType,
  TaskView,
} from './types';
import {
  PRIORITIES,
  PRIORITY_LABEL,
  STATUSES,
  STATUS_LABEL,
  TYPE_LABEL,
  TYPES,
} from './types';

export type TaskDialogMode =
  | { kind: 'create'; status?: TaskStatus; assigneeId?: string | null }
  | { kind: 'edit'; taskId: string };

export interface TaskDialogProps {
  mode: TaskDialogMode;
  members: BoardMember[];
  myId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  onClose(): void;
}

interface Draft {
  title: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  description: string;
}

function toLocalDateInputValue(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function checkHasUnsavedEdits(draft: Draft, task: TaskView): boolean {
  return (
    draft.title !== task.title ||
    draft.type !== task.type ||
    draft.status !== task.status ||
    draft.priority !== task.priority ||
    draft.assigneeId !== (task.assigneeId ?? '') ||
    draft.dueDate !== toLocalDateInputValue(task.dueDate) ||
    draft.description !== (task.description ?? '')
  );
}

function CreateDialogContent({
  mode,
  members,
  onClose,
  titleId,
}: {
  mode: { kind: 'create'; status?: TaskStatus; assigneeId?: string | null };
  members: BoardMember[];
  onClose(): void;
  titleId: string;
}) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleInputId = useId();
  const dueDateId = useId();
  const descId = useId();

  const [draft, setDraft] = useState<Draft>(() => ({
    title: '',
    type: 'TASK',
    status: mode.status ?? 'TODO',
    priority: 'MEDIUM',
    assigneeId: mode.assigneeId ?? '',
    dueDate: '',
    description: '',
  }));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) return;

    setSaving(true);
    setError(null);
    try {
      await taskActions.create({
        title: trimmedTitle,
        type: draft.type,
        status: draft.status,
        priority: draft.priority,
        assigneeId: draft.assigneeId ? draft.assigneeId : null,
        dueDate: draft.dueDate ? new Date(draft.dueDate + 'T00:00:00').toISOString() : null,
        description: draft.description,
      });
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError && err.message
          ? err.message
          : err instanceof Error && err.message
            ? err.message
            : 'Something went wrong. Try again.';
      setError(message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="flex items-center justify-between gap-3 pb-4">
        <h2 id={titleId} className="text-base font-semibold text-zinc-900">
          Create issue
        </h2>
        <IconButton aria-label="Close dialog" onClick={onClose} disabled={saving}>
          <X className="size-4" />
        </IconButton>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={titleInputId} className="sr-only">
          Title
        </label>
        <input
          id={titleInputId}
          ref={titleInputRef}
          type="text"
          required
          maxLength={200}
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          disabled={saving}
          placeholder="Issue title"
          className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-lg font-medium text-zinc-900 shadow-xs transition outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:pointer-events-none disabled:opacity-50"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Type"
          value={draft.type}
          onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as TaskType }))}
          disabled={saving}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </Select>

        <Select
          label="Status"
          value={draft.status}
          onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as TaskStatus }))}
          disabled={saving}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>

        <Select
          label="Priority"
          value={draft.priority}
          onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as TaskPriority }))}
          disabled={saving}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>

        <Select
          label="Assignee"
          value={draft.assigneeId}
          onChange={(e) => setDraft((d) => ({ ...d, assigneeId: e.target.value }))}
          disabled={saving}
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.displayName}
            </option>
          ))}
        </Select>

        <div className="flex flex-col gap-1.5 sm:col-span-1">
          <label htmlFor={dueDateId} className="text-sm font-medium text-zinc-800">
            Due date
          </label>
          <input
            id={dueDateId}
            type="date"
            value={draft.dueDate}
            onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
            disabled={saving}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-[15px] text-zinc-900 shadow-xs transition outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:pointer-events-none disabled:opacity-50"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor={descId} className="text-sm font-medium text-zinc-800">
          Description
        </label>
        <textarea
          id={descId}
          rows={6}
          maxLength={5000}
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          disabled={saving}
          placeholder="Add a more detailed description..."
          className="w-full resize-y rounded-xl border border-zinc-200 bg-white p-3.5 text-[15px] text-zinc-900 shadow-xs transition outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:pointer-events-none disabled:opacity-50"
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!draft.title.trim() || saving}
          loading={saving}
        >
          Create
        </Button>
      </div>
    </form>
  );
}

function EditDialogContent({
  task,
  members,
  myId,
  role,
  onClose,
  titleId,
}: {
  task: TaskView;
  members: BoardMember[];
  myId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  onClose(): void;
  titleId: string;
}) {
  const titleInputId = useId();
  const dueDateId = useId();
  const descId = useId();

  const [draft, setDraft] = useState<Draft>(() => ({
    title: task.title,
    type: task.type,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId ?? '',
    dueDate: toLocalDateInputValue(task.dueDate),
    description: task.description ?? '',
  }));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const lastUpdatedAtRef = useRef(task.updatedAt);
  const hasUnsavedEdits = checkHasUnsavedEdits(draft, task);

  useEffect(() => {
    if (lastUpdatedAtRef.current !== task.updatedAt) {
      lastUpdatedAtRef.current = task.updatedAt;
      if (!hasUnsavedEdits) {
        setDraft({
          title: task.title,
          type: task.type,
          status: task.status,
          priority: task.priority,
          assigneeId: task.assigneeId ?? '',
          dueDate: toLocalDateInputValue(task.dueDate),
          description: task.description ?? '',
        });
      }
    }
  }, [task.updatedAt, task, hasUnsavedEdits]);

  const canSave = hasUnsavedEdits && draft.title.trim().length > 0 && !saving;
  const canDelete = role === 'OWNER' || role === 'ADMIN' || task.reporterId === myId;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    const patch: TaskPatch = {};
    const trimmedTitle = draft.title.trim();
    if (trimmedTitle !== task.title) {
      patch.title = trimmedTitle;
    }
    if (draft.type !== task.type) {
      patch.type = draft.type;
    }
    if (draft.status !== task.status) {
      patch.status = draft.status;
    }
    if (draft.priority !== task.priority) {
      patch.priority = draft.priority;
    }
    const currentAssignee = task.assigneeId ?? '';
    if (draft.assigneeId !== currentAssignee) {
      patch.assigneeId = draft.assigneeId ? draft.assigneeId : null;
    }
    const currentDueDate = toLocalDateInputValue(task.dueDate);
    if (draft.dueDate !== currentDueDate) {
      patch.dueDate = draft.dueDate ? new Date(draft.dueDate + 'T00:00:00').toISOString() : null;
    }
    const currentDesc = task.description ?? '';
    if (draft.description !== currentDesc) {
      patch.description = draft.description;
    }

    setSaving(true);
    setError(null);
    try {
      await taskActions.update(task.id, patch);
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError && err.message
          ? err.message
          : err instanceof Error && err.message
            ? err.message
            : 'Something went wrong. Try again.';
      setError(message);
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError(null);
    try {
      await taskActions.remove(task.id);
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError && err.message
          ? err.message
          : err instanceof Error && err.message
            ? err.message
            : 'Something went wrong. Try again.';
      setError(message);
      setSaving(false);
    }
  };

  const reporter = members.find((m) => m.userId === task.reporterId);
  const reporterName = reporter?.displayName || 'Someone';
  const createdDate = task.createdAt ? new Date(task.createdAt).toLocaleDateString() : '';
  const updatedDate = task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : '';

  return (
    <form onSubmit={handleSave} className="flex flex-col">
      <div className="flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2">
          <TypeIcon type={draft.type} className="size-4 shrink-0" />
          <span
            id={titleId}
            className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-500"
          >
            {task.key}
          </span>
        </div>
        <IconButton aria-label="Close dialog" onClick={onClose} disabled={saving}>
          <X className="size-4" />
        </IconButton>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={titleInputId} className="sr-only">
          Title
        </label>
        <input
          id={titleInputId}
          type="text"
          required
          maxLength={200}
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          disabled={saving}
          placeholder="Issue title"
          className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-lg font-medium text-zinc-900 shadow-xs transition outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:pointer-events-none disabled:opacity-50"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Type"
          value={draft.type}
          onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as TaskType }))}
          disabled={saving}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </Select>

        <Select
          label="Status"
          value={draft.status}
          onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as TaskStatus }))}
          disabled={saving}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>

        <Select
          label="Priority"
          value={draft.priority}
          onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as TaskPriority }))}
          disabled={saving}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </Select>

        <Select
          label="Assignee"
          value={draft.assigneeId}
          onChange={(e) => setDraft((d) => ({ ...d, assigneeId: e.target.value }))}
          disabled={saving}
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.displayName}
            </option>
          ))}
        </Select>

        <div className="flex flex-col gap-1.5 sm:col-span-1">
          <label htmlFor={dueDateId} className="text-sm font-medium text-zinc-800">
            Due date
          </label>
          <input
            id={dueDateId}
            type="date"
            value={draft.dueDate}
            onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
            disabled={saving}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-[15px] text-zinc-900 shadow-xs transition outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:pointer-events-none disabled:opacity-50"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <label htmlFor={descId} className="text-sm font-medium text-zinc-800">
          Description
        </label>
        <textarea
          id={descId}
          rows={6}
          maxLength={5000}
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          disabled={saving}
          placeholder="Add a more detailed description..."
          className="w-full resize-y rounded-xl border border-zinc-200 bg-white p-3.5 text-[15px] text-zinc-900 shadow-xs transition outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:pointer-events-none disabled:opacity-50"
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-6 border-t border-zinc-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {canDelete &&
              (confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-600">Delete this issue?</span>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-red-600 text-white shadow-xs hover:bg-red-700 focus-visible:outline-red-600"
                    onClick={handleDelete}
                    disabled={saving}
                    loading={saving}
                  >
                    Yes, delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={saving}
                  >
                    Keep
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setConfirmDelete(true)}
                  disabled={saving}
                >
                  Delete
                </Button>
              ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!canSave}
              loading={saving}
            >
              Save
            </Button>
          </div>
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Reported by {reporterName} - Created {createdDate} - Updated {updatedDate}
        </p>
      </div>
    </form>
  );
}

export function TaskDialog({ mode, members, myId, role, onClose }: TaskDialogProps) {
  useEscape(true, onClose);

  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const { tasks } = useTasks();
  const task = mode.kind === 'edit' ? tasks.find((t) => t.id === mode.taskId) : undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mode.kind === 'edit' && !task) {
      onClose();
    }
  }, [mode.kind, task, onClose]);

  useEffect(() => {
    if (!mounted) return;
    if (mode.kind === 'edit') {
      panelRef.current?.focus();
    }
  }, [mounted, mode.kind]);

  if (!mounted) return null;
  if (mode.kind === 'edit' && !task) return null;

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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-captures-keys=""
        className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl bg-white p-5 shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {mode.kind === 'create' ? (
          <CreateDialogContent
            mode={mode}
            members={members}
            onClose={onClose}
            titleId={titleId}
          />
        ) : (
          task && (
            <EditDialogContent
              task={task}
              members={members}
              myId={myId}
              role={role}
              onClose={onClose}
              titleId={titleId}
            />
          )
        )}
      </div>
    </div>,
    document.body,
  );
}
