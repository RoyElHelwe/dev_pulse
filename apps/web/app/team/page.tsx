import type { Metadata } from 'next';
import { AppHeader } from '@/components/AppHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { TeamPage } from '@/features/team/TeamPage';

export const metadata: Metadata = { title: 'Team · Dev Pulse' };

export default function Page() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-zinc-600">Who is in your office, and who you invited.</p>
        <div className="mt-8">
          <TeamPage />
        </div>
      </main>
      <SiteFooter className="mx-auto max-w-4xl border-t border-zinc-200 px-4 py-8 sm:px-6" />
    </>
  );
}
