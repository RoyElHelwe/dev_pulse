/**
 * User presence status selection and custom status editor.
 * Displayed in the user menu for selecting preset or custom workplace statuses.
 */

'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

const MAX_STATUS_LENGTH_CHARS = 40;
const STATUS_PRESETS = ['Focusing', 'In a meeting', 'On break ☕', 'Back soon'];

/** Current presence status text and outer layout styling for the status selection section. */
export interface StatusSectionProps {
  status: string | null;
  className?: string;
}

/** Renders presence status preset buttons and a custom status input form. */
export function StatusSection({ status, className }: StatusSectionProps) {
  const [saving, setSaving] = useState(false);

  async function saveStatus(next: string) {
    setSaving(true);
    await api('/workspace/me', { method: 'PATCH', body: { status: next } }).catch(() => undefined);
    setSaving(false);
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-1.5">
        {STATUS_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={status === preset}
            disabled={saving}
            onClick={() => saveStatus(status === preset ? '' : preset)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-60',
              status === preset
                ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300',
            )}
          >
            {preset}
          </button>
        ))}
      </div>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem('status') as HTMLInputElement;
          void saveStatus(input.value.trim());
        }}
      >
        <input
          key={status ?? ''}
          name="status"
          defaultValue={status && !STATUS_PRESETS.includes(status) ? status : ''}
          maxLength={MAX_STATUS_LENGTH_CHARS}
          placeholder="Your own status…"
          aria-label="Custom status"
          className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-2.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
        >
          Set
        </button>
        {status && (
          <button
            type="button"
            disabled={saving}
            onClick={() => saveStatus('')}
            className="rounded-lg px-2 text-xs text-zinc-500 hover:bg-zinc-900/5 disabled:opacity-60"
          >
            Clear
          </button>
        )}
      </form>
    </div>
  );
}
