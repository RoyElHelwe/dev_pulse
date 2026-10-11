'use client';

/**
 * Multi-line textarea for task description editing.
 * Used in both create and edit task dialog flows.
 */

const MAX_DESCRIPTION_LENGTH = 5000;
const DESCRIPTION_ROWS = 6;

export interface TaskDescriptionFieldProps {
  id: string;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
}

/** Renders the resizable textarea for task descriptions. */
export function TaskDescriptionField({
  id,
  value,
  onChange,
  disabled,
}: TaskDescriptionFieldProps) {
  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        Description
      </label>
      <textarea
        id={id}
        rows={DESCRIPTION_ROWS}
        maxLength={MAX_DESCRIPTION_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Add a more detailed description..."
        className="w-full resize-y rounded-xl border border-zinc-200 bg-white p-3.5 text-[15px] text-zinc-900 shadow-xs transition outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:pointer-events-none disabled:opacity-50"
      />
    </div>
  );
}
