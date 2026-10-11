'use client';

/**
 * Grid layout grouping task type, status, priority, assignee, and due date fields.
 * Used in both create and edit task dialog flows.
 */

import { TaskAssigneeSelect } from './TaskAssigneeSelect';
import { TaskDueDateField } from './TaskDueDateField';
import { TaskPrioritySelect } from './TaskPrioritySelect';
import { TaskStatusSelect } from './TaskStatusSelect';
import { TaskTypeSelect } from './TaskTypeSelect';
import type { Draft } from './taskDialogUtils';
import type { BoardMember } from './types';

export interface TaskMetaFieldsProps {
  draft: Draft;
  onDraftChange: (updater: (prev: Draft) => Draft) => void;
  members: BoardMember[];
  dueDateId: string;
  disabled?: boolean;
}

/** Renders the responsive two-column grid of metadata dropdowns and date input. */
export function TaskMetaFields({
  draft,
  onDraftChange,
  members,
  dueDateId,
  disabled,
}: TaskMetaFieldsProps) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TaskTypeSelect
        value={draft.type}
        onChange={(type) => onDraftChange((d) => ({ ...d, type }))}
        disabled={disabled}
      />
      <TaskStatusSelect
        value={draft.status}
        onChange={(status) => onDraftChange((d) => ({ ...d, status }))}
        disabled={disabled}
      />
      <TaskPrioritySelect
        value={draft.priority}
        onChange={(priority) => onDraftChange((d) => ({ ...d, priority }))}
        disabled={disabled}
      />
      <TaskAssigneeSelect
        value={draft.assigneeId}
        onChange={(assigneeId) => onDraftChange((d) => ({ ...d, assigneeId }))}
        members={members}
        disabled={disabled}
      />
      <TaskDueDateField
        id={dueDateId}
        value={draft.dueDate}
        onChange={(dueDate) => onDraftChange((d) => ({ ...d, dueDate }))}
        disabled={disabled}
      />
    </div>
  );
}
