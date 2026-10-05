import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';
import { StackStatus } from '@/components/StackStatus';
import { Logo } from '@/components/ui/Logo';

export const metadata: Metadata = { title: 'Status · Dev Pulse' };

export default function StatusPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 sm:px-6">
      <header className="py-6">
        <Link href="/" className="inline-block rounded-lg" aria-label="Dev Pulse home">
          <Logo />
        </Link>
      </header>
      <main className="flex-1 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">System status</h1>
        <p className="mt-1 text-zinc-600">Checks every layer: HTTPS proxy, API, database and real-time connection.</p>
        <div className="mt-8">
          <StackStatus />
        </div>
      </main>
      <SiteFooter className="border-t border-zinc-200 py-8" />
    </div>
  );
}
