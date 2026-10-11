'use client';

/**
 * Dropdown select for task type (Task, Bug, Story).
 * Fits into the metadata grid of task dialogs.
 */

import { Select } from '@/components/ui/Select';
import type { TaskType } from './types';
import { TYPE_LABEL, TYPES } from './types';

export interface TaskTypeSelectProps {
  value: TaskType;
  onChange(value: TaskType): void;
  disabled?: boolean;
}

/** Renders the select input for picking task type. */
export function TaskTypeSelect({ value, onChange, disabled }: TaskTypeSelectProps) {
  return (
    <Select
      label="Type"
      value={value}
      onChange={(e) => onChange(e.target.value as TaskType)}
      disabled={disabled}
    >
      {TYPES.map((t) => (
        <option key={t} value={t}>
          {TYPE_LABEL[t]}
        </option>
      ))}
    </Select>
  );
}
