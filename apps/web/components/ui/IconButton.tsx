import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

// aria-label is required: an icon alone means nothing to a screen reader.
type IconButtonProps = ComponentProps<'button'> & { 'aria-label': string };

export function IconButton({ className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      title={props['aria-label']}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full text-zinc-600 transition',
        'hover:bg-zinc-900/5 hover:text-zinc-900 active:scale-95',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500',
        className,
      )}
      {...props}
    />
  );
}
