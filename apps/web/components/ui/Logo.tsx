import { cn } from '@/lib/cn';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#18181b" />
        <path
          d="M5 17h5l3-7 5 13 3-6h6"
          fill="none"
          stroke="#34d399"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Dev Pulse
    </span>
  );
}
