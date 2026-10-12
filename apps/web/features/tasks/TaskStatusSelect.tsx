'use client';

/**
 * Dropdown select for task workflow status.
 * Fits into the metadata grid of task dialogs.
 */

import { Select } from '@/components/ui/Select';
import type { TaskStatus } from './types';
import { STATUS_LABEL, STATUSES } from './types';

/** Selected workflow lane status, change callback, and disabled state for updating task lifecycle. */
export interface TaskStatusSelectProps {
  value: TaskStatus;
  onChange(value: TaskStatus): void;
  disabled?: boolean;
}

/** Renders the select input for picking task workflow status. */
export function TaskStatusSelect({ value, onChange, disabled }: TaskStatusSelectProps) {
  return (
    <Select
      label="Status"
      value={value}
      onChange={(e) => onChange(e.target.value as TaskStatus)}
      disabled={disabled}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </Select>
  );
}
