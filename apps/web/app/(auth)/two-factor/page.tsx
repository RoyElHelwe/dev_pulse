// Two-factor authentication page verifying TOTP or backup codes.

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TwoFactorForm } from '@/features/auth/TwoFactorForm';

/** Sets the browser tab title for the two-factor authentication verification route. */
export const metadata: Metadata = { title: 'Two-step verification · Dev Pulse' };

/** Two-factor authentication verification page. */
export default function Page() {
  return (
    <Suspense>
      <TwoFactorForm />
    </Suspense>
  );
}
