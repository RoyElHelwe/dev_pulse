'use client';

/**
 * Dropdown select for task priority.
 * Fits into the metadata grid of task dialogs.
 */

import { Select } from '@/components/ui/Select';
import type { TaskPriority } from './types';
import { PRIORITY_LABEL, PRIORITIES } from './types';

export interface TaskPrioritySelectProps {
  value: TaskPriority;
  onChange(value: TaskPriority): void;
  disabled?: boolean;
}

/** Renders the select input for picking task priority. */
export function TaskPrioritySelect({ value, onChange, disabled }: TaskPrioritySelectProps) {
  return (
    <Select
      label="Priority"
      value={value}
      onChange={(e) => onChange(e.target.value as TaskPriority)}
      disabled={disabled}
    >
      {PRIORITIES.map((p) => (
        <option key={p} value={p}>
          {PRIORITY_LABEL[p]}
        </option>
      ))}
    </Select>
  );
}
