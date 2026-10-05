import type { Metadata } from 'next';
import { OfficeView } from '@/features/office/OfficeView';

export const metadata: Metadata = { title: 'Office · Dev Pulse' };

// R1: a demo office. R3 moves this to /office/[workspaceId] after onboarding.
export default function OfficePage() {
  return <OfficeView />;
}
