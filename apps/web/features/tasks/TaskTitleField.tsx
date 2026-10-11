'use client';

/**
 * Text input for editing a task title with an accessible screen-reader label.
 * Used in both create and edit task dialog flows.
 */

import { type Ref } from 'react';

const MAX_TITLE_LENGTH = 200;

export interface TaskTitleFieldProps {
  id: string;
  inputRef?: Ref<HTMLInputElement>;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
}

/** Renders the prominent title input with screen-reader accessible label. */
export function TaskTitleField({
  id,
  inputRef,
  value,
  onChange,
  disabled,
}: TaskTitleFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="sr-only">
        Title
      </label>
      <input
        id={id}
        ref={inputRef}
        type="text"
        required
        maxLength={MAX_TITLE_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Issue title"
        className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-lg font-medium text-zinc-900 shadow-xs transition outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:pointer-events-none disabled:opacity-50"
      />
    </div>
  );
}
