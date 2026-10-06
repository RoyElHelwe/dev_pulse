import type { Metadata } from 'next';
import { SecuritySettings } from '@/features/settings/SecuritySettings';

export const metadata: Metadata = { title: 'Security · Dev Pulse' };

export default function SecurityPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
      <p className="mt-1 text-zinc-600">Your password, two-step sign-in and the devices where you are signed in.</p>
      <div className="mt-8">
        <SecuritySettings />
      </div>
    </>
  );
}
