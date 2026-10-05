import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/ui/Logo';
import { OfficeIllustration } from './OfficeIllustration';

interface AuthShellProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Small text under the card, e.g. "No account? Sign up". */
  footer?: ReactNode;
}

/** Layout of every sign-in page: the form on the left, the office on the right. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Link href="/" className="w-fit rounded-lg" aria-label="Dev Pulse home">
          <Logo />
        </Link>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-zinc-600">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <p className="mt-8 text-center text-sm text-zinc-600">{footer}</p>}
        </main>
      </div>
      <aside className="relative hidden overflow-hidden bg-zinc-900 p-3 lg:block">
        <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[28px] bg-zinc-950 p-10 text-white">
          <div className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.04)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <p className="relative text-sm font-medium text-emerald-300">Dev Pulse</p>
          <OfficeIllustration className="relative mx-auto w-full max-w-lg" />
          <div className="relative max-w-md">
            <p className="text-2xl font-semibold tracking-tight text-balance">Your team is already in the office.</p>
            <p className="mt-2 text-zinc-400">Walk over, say hi, and get back to work together.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
