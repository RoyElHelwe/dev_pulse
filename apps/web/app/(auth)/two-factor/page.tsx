import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TwoFactorForm } from '@/features/auth/TwoFactorForm';

export const metadata: Metadata = { title: 'Two-step verification · Dev Pulse' };

export default function Page() {
  return (
    <Suspense>
      <TwoFactorForm />
    </Suspense>
  );
}
