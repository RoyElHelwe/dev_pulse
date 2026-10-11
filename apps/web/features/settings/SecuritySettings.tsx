'use client';

// Composite settings view combining account info, 2FA, password, and active sessions.

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { AccountCard } from './AccountCard';
import { PasswordCard } from './PasswordCard';
import { SessionsCard } from './SessionsCard';
import { TwoFactorCard } from './TwoFactorCard';

/** Composite settings view for user account security controls. */
export function SecuritySettings() {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'signed-out') router.replace('/login?redirect=/settings/security');
  }, [status, router]);

  if (!user) {
    return <p className="py-20 text-center text-sm text-zinc-500">Loading…</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      <AccountCard user={user} />
      <TwoFactorCard user={user} />
      <PasswordCard user={user} />
      <SessionsCard />
    </div>
  );
}
