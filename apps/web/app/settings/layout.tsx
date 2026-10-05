import { AppHeader } from '@/components/AppHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SettingsNav } from '@/features/settings/SettingsNav';

/** Shared frame of the settings pages: header, the settings tabs, footer. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <SettingsNav />
        {children}
      </main>
      <SiteFooter className="mx-auto max-w-4xl border-t border-zinc-200 px-4 py-8 sm:px-6" />
    </>
  );
}
