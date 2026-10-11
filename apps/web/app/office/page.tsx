// Virtual office workspace page rendering the 2D workplace canvas.

import type { Metadata } from 'next';
import { OfficeView } from '@/features/office/OfficeView';

export const metadata: Metadata = { title: 'Office · Dev Pulse' };

// R1: a demo office. R3 moves this to /office/[workspaceId] after onboarding.
/** Main virtual office route displaying the interactive office view. */
export default function OfficePage() {
  return <OfficeView />;
}
