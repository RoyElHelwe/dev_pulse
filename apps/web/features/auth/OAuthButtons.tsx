'use client';

import { useEffect, useState } from 'react';
import { buttonStyles } from '@/components/ui/Button';
import { api } from '@/lib/api';

interface Provider {
  id: 'google' | 'github' | '42';
  label: string;
}

/**
 * "Continue with Google / GitHub / 42". Only providers configured on the
 * server are shown; nothing at all when none are.
 */
export function OAuthButtons({ redirect }: { redirect: string }) {
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    api<Provider[]>('/auth/providers').then(setProviders, () => setProviders([]));
  }, []);

  if (providers.length === 0) return null;
  return (
    <div className="mb-6 flex flex-col gap-2.5">
      {providers.map((p) => (
        // A real link: the browser leaves for the provider and comes back.
        <a
          key={p.id}
          href={`/api/auth/oauth/${p.id}?redirect=${encodeURIComponent(redirect)}`}
          className={buttonStyles('secondary', 'lg', 'w-full rounded-xl text-[15px]')}
        >
          <ProviderIcon id={p.id} />
          Continue with {p.label}
        </a>
      ))}
      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
        <span className="h-px flex-1 bg-zinc-200" />
        or with email
        <span className="h-px flex-1 bg-zinc-200" />
      </div>
    </div>
  );
}

function ProviderIcon({ id }: { id: Provider['id'] }) {
  if (id === 'google') {
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
      </svg>
    );
  }
  if (id === 'github') {
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z"
        />
      </svg>
    );
  }
  return (
    <span className="flex size-5 items-center justify-center rounded bg-zinc-900 text-[9px] font-bold text-white" aria-hidden="true">
      42
    </span>
  );
}
