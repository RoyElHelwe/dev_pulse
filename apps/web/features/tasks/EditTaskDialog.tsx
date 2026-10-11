'use client';

/**
 * Form for editing an existing task, updating fields, or deleting with confirmation.
 * Rendered inside TaskDialog when mode is 'edit'.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { ApiError } from '@/lib/api';
import { EditTaskFooter } from './EditTaskFooter';
import { TaskDescriptionField } from './TaskDescriptionField';
import { TypeIcon } from './TaskIcons';
import { TaskMetaFields } from './TaskMetaFields';
import { TaskTitleField } from './TaskTitleField';
import { taskActions } from './taskStore';
import {
  buildTaskPatch,
  checkHasUnsavedEdits,
  toLocalDateInputValue,
  type Draft,
} from './taskDialogUtils';
import type { BoardMember, TaskView } from './types';

export interface EditTaskDialogProps {
  task: TaskView;
  members: BoardMember[];
  myId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  onClose(): void;
  titleId: string;
}

/** Renders the editing form with change tracking, patch updates, and delete handling. */
export function EditTaskDialog({
  task,
  members,
  myId,
  role,
  onClose,
  titleId,
}: EditTaskDialogProps) {
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

  // Syncs background live updates into the draft only if the user has not made local changes.
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

    const patch = buildTaskPatch(draft, task);
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

      <TaskTitleField
        id={titleInputId}
        value={draft.title}
        onChange={(title) => setDraft((d) => ({ ...d, title }))}
        disabled={saving}
      />

      <TaskMetaFields
        draft={draft}
        onDraftChange={setDraft}
        members={members}
        dueDateId={dueDateId}
        disabled={saving}
      />

      <TaskDescriptionField
        id={descId}
        value={draft.description}
        onChange={(description) => setDraft((d) => ({ ...d, description }))}
        disabled={saving}
      />

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <EditTaskFooter
        canDelete={canDelete}
        confirmDelete={confirmDelete}
        onConfirmDeleteChange={setConfirmDelete}
        onDelete={handleDelete}
        canSave={canSave}
        saving={saving}
        onClose={onClose}
        reporterName={reporterName}
        createdDate={createdDate}
        updatedDate={updatedDate}
      />
    </form>
  );
}
