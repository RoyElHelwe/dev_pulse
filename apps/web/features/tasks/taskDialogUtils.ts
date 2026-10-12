/**
 * Shared types, draft formatting, and patch helpers for task creation and editing dialogs.
 * Used by CreateTaskDialog, EditTaskDialog, and TaskDialog.
 */

import type { TaskPatch, TaskPriority, TaskStatus, TaskType, TaskView } from './types';

/** Discriminated union indicating whether the task dialog creates a new task or edits an existing one. */
export type TaskDialogMode =
  | { kind: 'create'; status?: TaskStatus; assigneeId?: string | null }
  | { kind: 'edit'; taskId: string };

/** In-progress field state held in component memory while creating or editing a task. */
export interface Draft {
  title: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  description: string;
}

/** Formats an ISO date string into a local YYYY-MM-DD string for HTML date inputs. */
export function toLocalDateInputValue(isoString: string | null | undefined): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Checks whether any field in the draft differs from the original task values. */
export function checkHasUnsavedEdits(draft: Draft, task: TaskView): boolean {
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

/** Builds a patch object containing only fields modified from original task values. */
export function buildTaskPatch(draft: Draft, task: TaskView): TaskPatch {
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
  return patch;
}
