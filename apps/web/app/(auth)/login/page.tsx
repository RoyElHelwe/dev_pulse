// Login route rendering authentication form within the dev switcher gate.

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DevSwitcherGate } from '@/features/dev/DevSwitcher';
import { LoginForm } from '@/features/auth/LoginForm';

export const metadata: Metadata = { title: 'Sign in · Dev Pulse' };

/** Sign-in page rendering the login form wrapped in dev switcher detection. */
export default function LoginPage() {
  return (
    <Suspense>
      <DevSwitcherGate>
        <LoginForm />
      </DevSwitcherGate>
    </Suspense>
  );
}
