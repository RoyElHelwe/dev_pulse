// Password reset page completing the password recovery workflow with an emailed token.

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/features/auth/ResetPasswordForm';

export const metadata: Metadata = { title: 'Choose a new password · Dev Pulse' };

/** Password reset page verifying a reset token and setting a new password. */
export default function Page() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
