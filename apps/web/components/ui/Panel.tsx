import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Frosted-glass surface used for overlays on top of the office. */
export function Panel({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/70 bg-white/80 shadow-lg shadow-zinc-900/10 backdrop-blur-md',
        className,
      )}
      {...props}
    />
  );
}
