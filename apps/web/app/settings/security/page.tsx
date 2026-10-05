import type { Metadata } from 'next';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SecuritySettings } from '@/features/settings/SecuritySettings';

export const metadata: Metadata = { title: 'Security · Dev Pulse' };

export default function SecurityPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <nav aria-label="Settings" className="mb-6 flex gap-1 text-sm font-medium">
          <Link href="/settings/security" aria-current="page" className="rounded-full bg-zinc-900/5 px-3 py-1.5 text-zinc-900">
            Security
          </Link>
          <Link href="/settings/voice" className="rounded-full px-3 py-1.5 text-zinc-600 hover:bg-zinc-900/5 hover:text-zinc-900">
            Voice
          </Link>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="mt-1 text-zinc-600">Your password, two-step sign-in and the devices where you are signed in.</p>
        <div className="mt-8">
          <SecuritySettings />
        </div>
      </main>
      <SiteFooter className="mx-auto max-w-4xl border-t border-zinc-200 px-4 py-8 sm:px-6" />
    </>
  );
}
