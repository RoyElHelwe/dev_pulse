import Link from 'next/link';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/status', label: 'Status' },
];

/** Links every page must offer (the subject requires Privacy + Terms to be easy to find). */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('text-sm text-zinc-500', className)}>
      <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span>© {new Date().getFullYear()} Dev Pulse</span>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="underline-offset-4 hover:text-zinc-900 hover:underline">
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
