'use client';

/**
 * Date input field for specifying a task due date.
 * Fits into the metadata grid of task dialogs.
 */

export interface TaskDueDateFieldProps {
  id: string;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
}

/** Renders the labeled date picker input for task due dates. */
export function TaskDueDateField({
  id,
  value,
  onChange,
  disabled,
}: TaskDueDateFieldProps) {
  return (
    <div className="flex flex-col gap-1.5 sm:col-span-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        Due date
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-[15px] text-zinc-900 shadow-xs transition outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 disabled:pointer-events-none disabled:opacity-50"
      />
    </div>
  );
}
