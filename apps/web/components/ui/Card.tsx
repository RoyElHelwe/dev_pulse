import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps {
  title: string;
  description?: ReactNode;
  /** Shown on the right of the title (a badge, a button...). */
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Card({ title, description, aside, children, className }: CardProps) {
  return (
    <section className={cn('rounded-2xl bg-white p-5 ring-1 ring-zinc-200/80 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-zinc-600">{description}</p>}
        </div>
        {aside}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}
