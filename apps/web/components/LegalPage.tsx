import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/ui/Logo';
import { SiteFooter } from './SiteFooter';

/** Simple readable layout for the Privacy Policy and Terms of Service. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 sm:px-6">
      <header className="py-6">
        <Link href="/" className="inline-block rounded-lg" aria-label="Dev Pulse home">
          <Logo />
        </Link>
      </header>
      <main className="flex-1 py-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: {updated}</p>
        <div className="mt-10 space-y-4 leading-relaxed text-zinc-700 [&_a]:font-medium [&_a]:text-zinc-900 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_strong]:text-zinc-900 [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>
      <SiteFooter className="border-t border-zinc-200 py-8" />
    </div>
  );
}
