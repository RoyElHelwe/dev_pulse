'use client';

/**
 * Form for creating a new task issue with initial status and assignee presets.
 * Rendered inside TaskDialog when mode is 'create'.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ApiError } from '@/lib/api';
import { TaskDescriptionField } from './TaskDescriptionField';
import { TaskMetaFields } from './TaskMetaFields';
import { TaskTitleField } from './TaskTitleField';
import { taskActions } from './taskStore';
import type { Draft } from './taskDialogUtils';
import type { BoardMember, TaskStatus } from './types';

/** Field defaults, member choices, accessibility title ID, and close handler for the task creation form. */
export interface CreateTaskDialogProps {
  mode: { kind: 'create'; status?: TaskStatus; assigneeId?: string | null };
  members: BoardMember[];
  onClose(): void;
  titleId: string;
}

/** Renders the creation form with auto-focused title input and submission handling. */
export function CreateTaskDialog({
  mode,
  members,
  onClose,
  titleId,
}: CreateTaskDialogProps) {
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

      <TaskTitleField
        id={titleInputId}
        inputRef={titleInputRef}
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
