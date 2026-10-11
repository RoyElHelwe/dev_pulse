// Two-factor authentication page verifying TOTP or backup codes.

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TwoFactorForm } from '@/features/auth/TwoFactorForm';

export const metadata: Metadata = { title: 'Two-step verification · Dev Pulse' };

/** Two-factor authentication verification page. */
export default function Page() {
  return (
    <Suspense>
      <TwoFactorForm />
    </Suspense>
  );
}
