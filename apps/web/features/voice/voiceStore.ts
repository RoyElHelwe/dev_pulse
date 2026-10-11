// External state store tracking office-wide voice presence, mute, and deafen states.
// Consumed by presence lists and VoiceControls to maintain real-time voice indicators.

import { useSyncExternalStore } from 'react';

/** Audio suppression flags representing whether a participant has muted their microphone or deafened output. */
export interface VoiceState {
  muted: boolean;
  deafened: boolean;
}

/** One entry from the server: [userId, muted, deafened]; null, null = left voice. */
export type VoiceEntry = [string, boolean | null, boolean | null];

type States = ReadonlyMap<string, VoiceState>;

const EMPTY: States = new Map();
let states: States = EMPTY;
const listeners = new Set<() => void>();

function publish(next: States) {
  states = next;
  listeners.forEach((listener) => listener());
}

/** Voice state store updated by server broadcasts and queried by UI components. */
export const voiceStates = {
  get: () => states,
  has: (userId: string) => states.has(userId),
  apply([userId, muted, deafened]: VoiceEntry) {
    const next = new Map(states);
    if (muted === null || deafened === null) next.delete(userId);
    else next.set(userId, { muted, deafened });
    publish(next);
  },
  reset(entries: VoiceEntry[]) {
    publish(new Map(entries.filter(([, m, d]) => m !== null && d !== null).map(([id, muted, deafened]) => [id, { muted: !!muted, deafened: !!deafened }])));
  },
  clear: () => publish(EMPTY),
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

/** React hook subscribing to the global voice presence map. */
export function useVoiceStates(): States {
  return useSyncExternalStore(voiceStates.subscribe, voiceStates.get, () => EMPTY);
}
