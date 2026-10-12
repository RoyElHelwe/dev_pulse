'use client';

/**
 * Dropdown select for assigning a task to a workspace member.
 * Fits into the metadata grid of task dialogs.
 */

import { Select } from '@/components/ui/Select';
import type { BoardMember } from './types';

/** Selected assignee user ID, member options, disabled state, and change callback for assigning a task. */
export interface TaskAssigneeSelectProps {
  value: string;
  onChange(value: string): void;
  members: BoardMember[];
  disabled?: boolean;
}

/** Renders the select input for picking an assignee from workspace members. */
export function TaskAssigneeSelect({
  value,
  onChange,
  members,
  disabled,
}: TaskAssigneeSelectProps) {
  return (
    <Select
      label="Assignee"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">Unassigned</option>
      {members.map((m) => (
        <option key={m.userId} value={m.userId}>
          {m.displayName}
        </option>
      ))}
    </Select>
  );
}
