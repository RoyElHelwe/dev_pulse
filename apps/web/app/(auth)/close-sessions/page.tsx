import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CloseSessions } from '@/features/auth/CloseSessions';

export const metadata: Metadata = { title: 'Close your sessions · Dev Pulse' };

export default function Page() {
  return (
    <Suspense>
      <CloseSessions />
    </Suspense>
  );
}
