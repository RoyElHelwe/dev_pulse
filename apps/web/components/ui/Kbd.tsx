import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** A keyboard key, e.g. <Kbd>W</Kbd>. */
export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-zinc-200 bg-white px-1.5',
        'font-sans text-[11px] font-semibold text-zinc-600 shadow-[0_1px_0_0_rgb(228_228_231)]',
        className,
      )}
      {...props}
    />
  );
}
