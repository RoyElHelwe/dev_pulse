// Workspace setup route guiding first-time users through office onboarding.

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { OnboardingGate } from '@/features/onboarding/OnboardingGate';

/** Sets the browser tab title for the initial workspace configuration flow. */
export const metadata: Metadata = { title: 'Set up your office · Dev Pulse' };

/** Onboarding page wrapping the workspace creation and setup flow. */
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
