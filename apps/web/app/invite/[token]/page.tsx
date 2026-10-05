import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';
import { Logo } from '@/components/ui/Logo';
import { InvitationView } from '@/features/onboarding/InvitationView';

export const metadata: Metadata = { title: 'Invitation · Dev Pulse' };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="flex min-h-dvh flex-col px-4 sm:px-6">
      <header className="mx-auto w-full max-w-4xl py-6">
        <Link href="/" className="inline-block rounded-lg" aria-label="Dev Pulse home">
          <Logo />
        </Link>
      </header>
      <main className="flex-1 py-12 sm:py-20">
        <InvitationView token={token} />
      </main>
      <SiteFooter className="mx-auto w-full max-w-4xl border-t border-zinc-200 py-8" />
    </div>
  );
}
