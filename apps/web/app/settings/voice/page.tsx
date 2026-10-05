import type { Metadata } from 'next';
import { VoiceSettings } from '@/features/voice/VoiceSettings';

export const metadata: Metadata = { title: 'Voice · Dev Pulse' };

export default function VoicePage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Voice</h1>
      <p className="mt-1 text-zinc-600">How people near you in the office hear you.</p>
      <div className="mt-8">
        <VoiceSettings />
      </div>
    </>
  );
}
