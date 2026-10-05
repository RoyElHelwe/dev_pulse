'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/settings/security', label: 'Security' },
  { href: '/settings/voice', label: 'Voice' },
];

/** Tabs between the settings pages; the current one is marked. */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="mb-6 flex gap-1 text-sm font-medium">
      {LINKS.map(({ href, label }) => {
        const current = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'rounded-full px-3 py-1.5',
              current ? 'bg-zinc-900/5 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-900/5 hover:text-zinc-900',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
