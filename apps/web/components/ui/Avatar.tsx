import { cn } from '@/lib/cn';

const COLORS = ['bg-emerald-600', 'bg-sky-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-teal-600'];

/** Profile picture, or initials on a colour picked from the name. */
export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const color = COLORS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % COLORS.length];

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- external avatar URLs (Google, GitHub, 42)
    return <img src={src} alt="" referrerPolicy="no-referrer" className={cn('size-8 rounded-full object-cover', className)} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn('flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white', color, className)}
    >
      {initials}
    </span>
  );
}
