'use client';

import { Eye, EyeOff } from 'lucide-react';
import { type ComponentProps, type ReactNode, useId, useState } from 'react';
import { cn } from '@/lib/cn';

interface TextFieldProps extends ComponentProps<'input'> {
  label: string;
  error?: string;
  hint?: ReactNode;
  /** Extra element on the right of the label (e.g. "Forgot password?"). */
  labelAside?: ReactNode;
}

/** Label + input + hint or error, wired for screen readers. Passwords get a show/hide toggle. */
export function TextField({ label, error, hint, labelAside, id, type = 'text', className, ...props }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="text-sm font-medium text-zinc-800">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="relative">
        <input
          id={inputId}
          type={isPassword && visible ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={cn(
            'h-11 w-full rounded-xl border border-zinc-200 bg-white px-3.5 text-[15px] text-zinc-900 shadow-xs transition outline-none',
            'placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5',
            'aria-invalid:border-rose-300 aria-invalid:focus:ring-rose-500/10',
            isPassword && 'pr-11',
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-zinc-400 transition hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-emerald-500"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={messageId} className="text-sm text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
