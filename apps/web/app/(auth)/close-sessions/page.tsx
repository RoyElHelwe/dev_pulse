// Emergency security route revoking all account sessions via an emailed token.

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CloseSessions } from '@/features/auth/CloseSessions';

export const metadata: Metadata = { title: 'Close your sessions · Dev Pulse' };

/** Emergency session termination page. */
export default function Page() {
  return (
    <Suspense>
      <CloseSessions />
    </Suspense>
  );
}
