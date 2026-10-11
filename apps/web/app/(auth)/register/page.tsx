// Registration route rendering account creation form within the dev switcher gate.

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DevSwitcherGate } from '@/features/dev/DevSwitcher';
import { RegisterForm } from '@/features/auth/RegisterForm';

export const metadata: Metadata = { title: 'Create your account · Dev Pulse' };

/** Registration page rendering the account sign-up form wrapped in dev switcher detection. */
export default function RegisterPage() {
  return (
    <Suspense>
      <DevSwitcherGate>
        <RegisterForm />
      </DevSwitcherGate>
    </Suspense>
  );
}
