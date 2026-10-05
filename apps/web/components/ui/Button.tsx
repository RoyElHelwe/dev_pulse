import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' +
  'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

const variants: Record<Variant, string> = {
  primary: 'bg-zinc-900 text-white shadow-sm hover:bg-zinc-800',
  secondary: 'bg-white text-zinc-900 ring-1 ring-zinc-200 shadow-sm hover:bg-zinc-50',
  ghost: 'text-zinc-600 hover:bg-zinc-900/5 hover:text-zinc-900',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

/** Class names for a button; also usable on <Link> so links look like buttons. */
export function buttonStyles(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<'button'> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles(variant, size, className)} {...props} />;
}
