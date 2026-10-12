// Email verification page confirming an account using an emailed verification token.

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VerifyEmail } from '@/features/auth/VerifyEmail';

/** Sets the browser tab title for the email address confirmation page. */
export const metadata: Metadata = { title: 'Confirm your email · Dev Pulse' };

/** Email verification confirmation page. */
export default function Page() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
