import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Checkbox({ label, className, ...props }: ComponentProps<'input'> & { label: ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 text-sm text-zinc-700 select-none', className)}>
      <input type="checkbox" className="size-4 rounded border-zinc-300 accent-zinc-900" {...props} />
      {label}
    </label>
  );
}
