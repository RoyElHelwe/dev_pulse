'use client';

// Floating bottom HUD bar for controlling microphone, deafen, and voice channel participation.
// Fits into OfficeFeatures to provide user controls and hotkey bindings for proximity voice.

import { HeadphoneOff, Headphones, Mic, MicOff, PhoneOff, Settings } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IconButton, iconButtonStyles } from '@/components/ui/IconButton';
import { Kbd } from '@/components/ui/Kbd';
import { Panel } from '@/components/ui/Panel';
import type { OfficeFeatureProps } from '@/features/office/types';
import { CharacterFace } from '@/features/workspace/CharacterPreview';
import { getKeybinds, useKeybinds } from '@/features/settings/keybindStore';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { isTyping } from '@/lib/dom';
import { DEFAULT_VOICE_SETTINGS, keyName, type VoiceSettings } from './settings';
import { type VoiceEntry, voiceStates } from './voiceStore';
import { type VoiceSnapshot, VoiceManager } from './VoiceManager';

const MAX_VISIBLE_AVATAR_PREVIEWS = 3;
const IDLE: VoiceSnapshot = { joined: false, muted: false, deafened: false, pushToTalk: false, live: false, peers: [] };

/** Voice control bar component managing microphone state, deafening, and proximity indicators. */
export function VoiceControls({ socket, controller, workspace, people, myId, onToast, editing }: OfficeFeatureProps) {
  const keybinds = useKeybinds();
  const [voice, setVoice] = useState<VoiceSnapshot>(IDLE);
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [joining, setJoining] = useState(false);
  const managerRef = useRef<VoiceManager | null>(null);
  const controllerRef = useRef(controller);
  controllerRef.current = controller;
  const layoutRef = useRef(workspace.layout);
  layoutRef.current = workspace.layout;

  // Synchronize overall voice membership and mute flags for all workspace peers.
  useEffect(() => {
    if (!socket) return;
    const sync = () => socket.emit('voice:states', (entries: VoiceEntry[]) => Array.isArray(entries) && voiceStates.reset(entries));
    const onVoice = (entry: VoiceEntry) => Array.isArray(entry) && voiceStates.apply(entry);
    socket.on('office:voice', onVoice);
    socket.on('connect', sync);
    if (socket.connected) sync();
    return () => {
      socket.off('office:voice', onVoice);
      socket.off('connect', sync);
      voiceStates.clear();
    };
  }, [socket]);

  // One voice engine coordinator instance per active office socket session.
  useEffect(() => {
    if (!socket) return;
    const manager = new VoiceManager({
      socket,
      myId,
      controller: () => controllerRef.current,
      onChange: () => setVoice(manager.snapshot()),
    });
    manager.setLayout(layoutRef.current);
    managerRef.current = manager;
    return () => {
      manager.destroy();
      managerRef.current = null;
      setVoice(IDLE);
    };
  }, [socket, myId]);

  useEffect(() => managerRef.current?.setLayout(workspace.layout), [workspace.layout]);

  // Load user microphone preference (open mic vs push-to-talk).
  useEffect(() => {
    let cancelled = false;
    api<VoiceSettings>('/settings').then(
      (s) => !cancelled && setSettings(s),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => managerRef.current?.setPushToTalk(settings.voiceMode === 'PUSH_TO_TALK'), [settings.voiceMode, socket]);

  // Handle global shortcuts: mute, deafen, and push-to-talk key states while ignoring focused text fields.
  const pttKey = settings.voiceMode === 'PUSH_TO_TALK' ? keybinds.pushToTalk : null;
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const manager = managerRef.current;
      if (!manager || isTyping()) return;
      const state = manager.snapshot();
      if (!state.joined) return;
      // Intercept push-to-talk key before modifiers; prevent default to stop Space from scrolling page.
      if (e.code === pttKey) {
        e.preventDefault();
        return manager.setKeyHeld(true);
      }
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const bound = getKeybinds();
      // Pressing mute while deafened un-deafens first, matching expected headset behaviour.
      if (e.code === bound.mute) return state.deafened ? manager.setDeafened(false) : manager.setMuted(!state.muted);
      if (e.code === bound.deafen) manager.setDeafened(!state.deafened);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== pttKey) return;
      if (!isTyping()) e.preventDefault();
      managerRef.current?.setKeyHeld(false);
    };
    const blur = () => managerRef.current?.setKeyHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [pttKey]);

  async function onMic() {
    const manager = managerRef.current;
    if (!manager) return;
    if (voice.deafened) return manager.setDeafened(false);
    if (voice.joined) return manager.setMuted(!voice.muted);
    setJoining(true);
    const result = await manager.join();
    setJoining(false);
    if (result === 'denied') onToast('Microphone blocked. Allow it in your browser’s site settings to talk.');
    if (result === 'no-mic') onToast('No microphone found. Plug one in and try again.');
    if (result === 'unsupported') onToast('Voice isn’t supported in this browser.');
  }

  const muteKey = keyName(keybinds.mute);
  const deafenKey = keyName(keybinds.deafen);
  const micOff = voice.joined && (voice.muted || voice.deafened);
  const micLabel = !voice.joined ? 'Join voice' : voice.deafened ? `Undeafen (${muteKey})` : voice.muted ? `Unmute (${muteKey})` : `Mute (${muteKey})`;
  const heard = voice.peers.map((id) => people.find((p) => p.id === id)).filter((p) => !!p);

  if (editing) return null;
  return (
    <Panel className="absolute top-20 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 p-1 sm:top-auto sm:bottom-5">
      <IconButton
        aria-label={micLabel}
        aria-pressed={voice.joined && !voice.deafened ? voice.muted : undefined}
        onClick={onMic}
        disabled={!socket || joining}
        className={cn(
          !voice.joined && 'text-zinc-500',
          micOff && 'bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700',
          voice.live && 'bg-emerald-50 text-emerald-700',
        )}
      >
        {voice.joined && !micOff ? <Mic className="size-4" /> : <MicOff className="size-4" />}
      </IconButton>
      <IconButton
        aria-label={voice.deafened ? `Undeafen (${deafenKey})` : `Deafen (${deafenKey})`}
        aria-pressed={voice.deafened}
        onClick={() => managerRef.current?.setDeafened(!voice.deafened)}
        disabled={!voice.joined}
        className={cn('disabled:opacity-40', voice.deafened && 'bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700')}
      >
        {voice.deafened ? <HeadphoneOff className="size-4" /> : <Headphones className="size-4" />}
      </IconButton>

      {voice.joined && (
        <>
          <span className="mx-0.5 h-5 w-px bg-zinc-200" />
          <span className="flex items-center gap-1.5 px-1 text-xs text-zinc-600" aria-live="polite">
            {heard.length > 0 ? (
              <>
                <span className="flex -space-x-1.5">
                  {heard.slice(0, MAX_VISIBLE_AVATAR_PREVIEWS).map((p) => (
                    <CharacterFace key={p.id} character={p.character} className="size-5 ring-2 ring-white" />
                  ))}
                </span>
                <span className="hidden sm:inline">
                  {heard.length === 1 ? heard[0].name.split(' ')[0] : `${heard.length} people`}
                </span>
              </>
            ) : (
              <span className="hidden sm:inline">No one in earshot</span>
            )}
          </span>
          {voice.pushToTalk && !micOff && (
            <span className={cn('hidden items-center gap-1 px-1 text-xs sm:flex', voice.live ? 'text-emerald-700' : 'text-zinc-500')}>
              {voice.live ? (
                'Talking…'
              ) : (
                <>
                  Hold <Kbd>{keyName(keybinds.pushToTalk)}</Kbd> to talk
                </>
              )}
            </span>
          )}
          <IconButton aria-label="Leave voice" onClick={() => managerRef.current?.leave()}>
            <PhoneOff className="size-4" />
          </IconButton>
        </>
      )}
      <Link
        href="/settings/voice"
        aria-label="Voice settings"
        title="Voice settings"
        className={iconButtonStyles('text-zinc-500')}
      >
        <Settings className="size-4" />
      </Link>
    </Panel>
  );
}
