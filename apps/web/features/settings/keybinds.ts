'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { api, ApiError } from '@/lib/api';
import { isTyping } from '@/lib/dom';
import { keyName } from '@/features/voice/settings';

// One keybind store for the whole app. Every key listener (voice, E in the game,
// chat / board / rooms / people toggles) reads it, the Keybinds modal and
// /settings/voice write it. Saved per user on the server (`/settings`).

export const KEYBIND_ACTIONS = ['interact', 'mute', 'deafen', 'pushToTalk', 'chat', 'board', 'rooms', 'people', 'foosKick', 'foosSwitch'] as const;
export type KeybindAction = (typeof KEYBIND_ACTIONS)[number];
export type Keybinds = Record<KeybindAction, string>;

/** Same defaults and rules as the API (apps/api/src/settings/keybinds.ts). */
export const DEFAULT_KEYBINDS: Keybinds = {
  interact: 'KeyE',
  mute: 'KeyM',
  deafen: 'KeyH',
  pushToTalk: 'KeyV',
  chat: 'KeyC',
  board: 'KeyB',
  rooms: 'KeyT',
  people: 'KeyP',
  foosKick: 'Space',
  foosSwitch: 'KeyQ',
};

export const KEYBIND_LABELS: Record<KeybindAction, { label: string; hint: string }> = {
  interact: { label: 'Use / interact', hint: 'Sit, open your desk, claim a desk' },
  mute: { label: 'Mute microphone', hint: 'While in voice' },
  deafen: { label: 'Deafen', hint: 'While in voice' },
  pushToTalk: { label: 'Push to talk', hint: 'Hold to talk (push-to-talk mode)' },
  chat: { label: 'Chat', hint: 'Open or close the chat panel' },
  board: { label: 'Task board', hint: 'Drop the Kanban board down or up' },
  rooms: { label: 'Rooms & timetable', hint: 'Open or close the meeting rooms' },
  people: { label: 'People list', hint: 'Open or close who is here' },
  foosKick: { label: 'Foosball: kick', hint: 'Kick with the selected rod (move rods with W/S or ↑/↓)' },
  foosSwitch: { label: 'Foosball: switch rod', hint: 'Cycle through the rods you control' },
};

/** Keys that walk, close or confirm: never bindable. */
export const RESERVED_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', 'Enter', 'Tab',
]);

/** Same rule as the API. */
export const KEY_CODE = /^[A-Za-z0-9]{1,24}$/;

interface State {
  keybinds: Keybinds;
  loaded: boolean;
}

let state: State = { keybinds: DEFAULT_KEYBINDS, loaded: false };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function set(next: State) {
  state = next;
  for (const l of listeners) l();
}

function normalize(raw: unknown): Keybinds {
  const out = { ...DEFAULT_KEYBINDS };
  if (raw && typeof raw === 'object') {
    for (const action of KEYBIND_ACTIONS) {
      const value = (raw as Record<string, unknown>)[action];
      if (typeof value === 'string' && KEY_CODE.test(value)) out[action] = value;
    }
  }
  return out;
}

export function getKeybinds(): Keybinds {
  return state.keybinds;
}

/** Fetches the user's keybinds (once per call while none is in flight). */
export function loadKeybinds(): Promise<void> {
  inflight ??= api<{ keybinds?: unknown; pushToTalkKey?: string }>('/settings')
    .then((s) => set({ keybinds: normalize({ ...(s.keybinds as object), pushToTalk: s.pushToTalkKey ?? (s.keybinds as Keybinds | undefined)?.pushToTalk }), loaded: true }))
    .catch(() => undefined) // keep the defaults / what we have
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** The action that already uses `code`, if any (other than `except`). */
export function actionUsing(code: string, except?: KeybindAction, from: Keybinds = state.keybinds): KeybindAction | null {
  return KEYBIND_ACTIONS.find((a) => a !== except && from[a] === code) ?? null;
}

export type RebindResult = { ok: true } | { ok: false; error: string };

/**
 * Binds `code` to `action`. If another action holds the key: with `swap` the two
 * trade keys, otherwise the call is refused (`conflict` tells which action).
 */
export async function rebind(
  action: KeybindAction,
  code: string,
  opts: { swap?: boolean } = {},
): Promise<RebindResult> {
  if (!KEY_CODE.test(code)) return { ok: false, error: 'That key can’t be used. Try another one.' };
  if (RESERVED_KEYS.has(code)) return { ok: false, error: `${keyName(code)} is used to walk or close things. Try another key.` };
  const other = actionUsing(code, action);
  const next = { ...state.keybinds, [action]: code };
  if (other) {
    if (!opts.swap) return { ok: false, error: `${keyName(code)} is already used for ${KEYBIND_LABELS[other].label}.` };
    next[other] = state.keybinds[action];
  }
  return save(next);
}

export function resetKeybinds(): Promise<RebindResult> {
  return save({ ...DEFAULT_KEYBINDS });
}

async function save(next: Keybinds): Promise<RebindResult> {
  const previous = state;
  set({ keybinds: next, loaded: true });
  try {
    const saved = await api<{ keybinds?: unknown }>('/settings', { method: 'PATCH', body: { keybinds: next } });
    if (saved.keybinds) set({ keybinds: normalize(saved.keybinds), loaded: true });
    return { ok: true };
  } catch (err) {
    set(previous);
    return { ok: false, error: err instanceof ApiError ? err.message : 'Could not reach the server.' };
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The current keybinds (re-renders on change); loads them from the server on first use. */
export function useKeybinds(): Keybinds {
  useEffect(() => {
    if (!state.loaded) void loadKeybinds();
  }, []);
  return useSyncExternalStore(subscribe, getKeybinds, () => DEFAULT_KEYBINDS);
}

/** "KeyC" → "C" for the action's current key (for hints). */
export function useKeyName(action: KeybindAction): string {
  return keyName(useKeybinds()[action]);
}

/** Is this key event the bound key for `action`? No modifiers, no auto-repeat. */
export function matchesKey(e: KeyboardEvent, action: KeybindAction) {
  return e.code === state.keybinds[action] && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey;
}

/**
 * Runs `handler` when the user presses the key bound to `action`, unless they are
 * typing or `enabled` is false. Handler may be a fresh closure on each render.
 */
export function useKeybind(action: KeybindAction, handler: () => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useKeybinds(); // make sure they are loaded
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (!matchesKey(e, action) || isTyping()) return;
      e.preventDefault();
      ref.current();
    },
    [action],
  );
  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, onKey]);
}
