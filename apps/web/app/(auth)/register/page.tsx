import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DevSwitcherGate } from '@/features/auth/DevSwitcher';
import { RegisterForm } from '@/features/auth/RegisterForm';

export const metadata: Metadata = { title: 'Create your account · Dev Pulse' };

export default function RegisterPage() {
  return (
    <Suspense>
      <DevSwitcherGate>
        <RegisterForm />
      </DevSwitcherGate>
    </Suspense>
  );
}
