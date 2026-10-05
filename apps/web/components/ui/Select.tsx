import { ChevronDown } from 'lucide-react';
import { type ComponentProps, useId } from 'react';
import { cn } from '@/lib/cn';

interface SelectProps extends ComponentProps<'select'> {
  label?: string;
}

/** Native select (keyboard and screen-reader friendly), styled like TextField. */
export function Select({ label, id, className, children, ...props }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-zinc-800">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className="h-11 w-full appearance-none rounded-xl border border-zinc-200 bg-white pr-9 pl-3.5 text-[15px] text-zinc-900 shadow-xs outline-none focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5"
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-400" />
      </div>
    </div>
  );
}
