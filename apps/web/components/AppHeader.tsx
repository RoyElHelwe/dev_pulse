import Link from 'next/link';
import { buttonStyles } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { UserMenu } from '@/features/auth/UserMenu';

/** Top bar of the app pages (settings, later profile, members...). */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-lg" aria-label="Dev Pulse home">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/office" className={buttonStyles('ghost', 'sm')}>
            Office
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
