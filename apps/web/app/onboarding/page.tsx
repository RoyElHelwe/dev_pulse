import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';

export const metadata: Metadata = { title: 'Set up your office · Dev Pulse' };

export default function OnboardingPage() {
  return (
    <>
      <AppHeader />
      <main className="px-4 py-10 sm:px-6 sm:py-16">
        <Suspense>
          <OnboardingGate />
        </Suspense>
      </main>
    </>
  );
}
