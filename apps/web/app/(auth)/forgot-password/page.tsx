import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ForgotPasswordForm } from '@/features/auth/ForgotPasswordForm';

export const metadata: Metadata = { title: 'Forgot password · Dev Pulse' };

export default function Page() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
