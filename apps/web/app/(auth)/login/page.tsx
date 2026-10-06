import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DevSwitcherGate } from '@/features/auth/DevSwitcher';
import { LoginForm } from '@/features/auth/LoginForm';

export const metadata: Metadata = { title: 'Sign in · Dev Pulse' };

export default function LoginPage() {
  return (
    <Suspense>
      <DevSwitcherGate>
        <LoginForm />
      </DevSwitcherGate>
    </Suspense>
  );
}
