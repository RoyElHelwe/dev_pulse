// Password recovery request page generating a reset email link.

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ForgotPasswordForm } from '@/features/auth/ForgotPasswordForm';

/** Sets the browser tab title for the password recovery request route. */
export const metadata: Metadata = { title: 'Forgot password · Dev Pulse' };

/** Password recovery request page for generating a password reset email. */
export default function Page() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
