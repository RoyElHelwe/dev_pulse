'use client';

import { Keyboard, Mic } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Kbd } from '@/components/ui/Kbd';
import { useAuth } from '@/features/auth/AuthProvider';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { rebind, useKeybinds } from '@/features/settings/keybinds';
import { keyName, type VoiceMode, type VoiceSettings as Settings } from './settings';

const MODES: { mode: VoiceMode; title: string; text: string; Icon: typeof Mic }[] = [
  { mode: 'OPEN', title: 'Open mic', text: 'People nearby hear you whenever you are not muted (M).', Icon: Mic },
  { mode: 'PUSH_TO_TALK', title: 'Push to talk', text: 'Your mic is only on while you hold a key.', Icon: Keyboard },
];

/** /settings/voice: open mic or push-to-talk, and which key. Saved at once. */
export function VoiceSettings() {
  const { status, user } = useAuth();
  const router = useRouter();
  const keybinds = useKeybinds();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [picking, setPicking] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status === 'signed-out') router.replace('/login?redirect=/settings/voice');
  }, [status, router]);

  useEffect(() => {
    if (!user) return;
    api<Settings>('/settings').then(setSettings, () => setMessage({ tone: 'error', text: 'Could not load your voice settings.' }));
  }, [user]);

  async function save(changes: Partial<Settings>) {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, ...changes });
    try {
      setSettings(await api<Settings>('/settings', { method: 'PATCH', body: changes }));
      setMessage({ tone: 'success', text: 'Saved.' });
    } catch (err) {
      setSettings(previous);
      setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not reach the server.' });
    }
  }

  // "Press a key": the next key pressed becomes the push-to-talk key (Escape cancels).
  useEffect(() => {
    if (!picking) return;
    const pick = async (e: KeyboardEvent) => {
      e.preventDefault();
      setPicking(false);
      if (e.code === 'Escape') return;
      const result = await rebind('pushToTalk', e.code);
      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error });
      } else {
        setMessage({ tone: 'success', text: 'Saved.' });
      }
    };
    window.addEventListener('keydown', pick);
    return () => window.removeEventListener('keydown', pick);
  }, [picking]);

  if (!user || !settings) {
    return <p className="py-20 text-center text-sm text-zinc-500">{message?.text ?? 'Loading…'}</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      <Card title="How your mic works" description="Your choice applies the next time you enter the office.">
        <div role="radiogroup" aria-label="Voice mode" className="grid gap-3 sm:grid-cols-2">
          {MODES.map(({ mode, title, text, Icon }) => {
            const selected = settings.voiceMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => !selected && void save({ voiceMode: mode })}
                className={cn(
                  'flex gap-3 rounded-xl p-4 text-left ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500',
                  selected ? 'bg-emerald-50/60 ring-2 ring-emerald-500' : 'ring-zinc-200 hover:bg-zinc-50',
                )}
              >
                <Icon className={cn('mt-0.5 size-5 shrink-0', selected ? 'text-emerald-600' : 'text-zinc-500')} aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="mt-0.5 block text-sm text-zinc-600">{text}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {settings.voiceMode === 'PUSH_TO_TALK' && (
        <Card
          title="Push-to-talk key"
          description="Hold it to talk. It does nothing while you type in a text field."
          aside={<Kbd className="h-8 min-w-8 text-sm">{keyName(keybinds.pushToTalk)}</Kbd>}
        >
          <Button variant="secondary" onClick={() => setPicking(!picking)} aria-pressed={picking}>
            {picking ? 'Press a key… (Esc to cancel)' : 'Change key'}
          </Button>
        </Card>
      )}

      {message && (
        <Alert tone={message.tone} className="sm:max-w-md">
          {message.text}
        </Alert>
      )}

      <p className="text-sm text-zinc-500">
        In the office: <Kbd>{keyName(keybinds.mute)}</Kbd> mutes your mic, <Kbd>{keyName(keybinds.deafen)}</Kbd> deafens (you hear no one and nobody hears you). You can change them in the user menu → Keybinds.
      </p>
    </div>
  );
}
