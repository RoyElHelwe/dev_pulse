import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'error' | 'success' | 'info';

const STYLES: Record<Tone, string> = {
  error: 'bg-rose-50 text-rose-800 ring-rose-200/70',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70',
  info: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
};

const ICONS = { error: CircleAlert, success: CircleCheck, info: Info };

export function Alert({ tone = 'info', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-xl px-3.5 py-3 text-sm ring-1', STYLES[tone], className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
