'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { OnboardingWizard } from './OnboardingWizard';

/** Only for signed-in people without an office; everyone else goes where they belong. */
export function OnboardingGate() {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'signed-out') router.replace('/login?redirect=/onboarding');
    if (user?.workspace) router.replace('/office');
  }, [status, user, router]);

  if (!user || user.workspace) return <p className="py-24 text-center text-sm text-zinc-500">Loading…</p>;
  return <OnboardingWizard />;
}
