'use client';

// One keybind store for the whole app. Every key listener (voice, E in the game, chat / board /
// rooms / people toggles) reads it; the Keybinds modal and /settings/voice write it.
// Saved per user on the server (`/settings`). Definitions and defaults: keybinds.ts.

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { keyName } from '@/features/voice/settings';
import { api, ApiError } from '@/lib/api';
import { isTyping } from '@/lib/dom';
import {
  actionUsing,
  DEFAULT_KEYBINDS,
  KEY_CODE,
  KEYBIND_LABELS,
  normalizeKeybinds,
  RESERVED_KEYS,
  type KeybindAction,
  type Keybinds,
} from './keybinds';

interface State {
  keybinds: Keybinds;
  /** True once the server answered (or the user changed something), so we stop re-fetching. */
  loaded: boolean;
}

let state: State = { keybinds: DEFAULT_KEYBINDS, loaded: false };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function set(next: State) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The current keybinds, for code outside React (key handlers inside the game). */
export function getKeybinds(): Keybinds {
  return state.keybinds;
}

/** Fetches the user's keybinds (one request at a time; failures keep what we have). */
function loadKeybinds(): Promise<void> {
  inflight ??= api<{ keybinds?: unknown; pushToTalkKey?: string }>('/settings')
    .then((s) =>
      // `pushToTalkKey` is the older, separate setting: it wins over a missing keybinds.pushToTalk.
      set({
        keybinds: normalizeKeybinds({ ...(s.keybinds as object), pushToTalk: s.pushToTalkKey ?? (s.keybinds as Keybinds | undefined)?.pushToTalk }),
        loaded: true,
      }),
    )
    .catch(() => undefined) // keep the defaults / what we have
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Outcome of a key binding modification request, indicating success or failure with an error message. */
export type RebindResult = { ok: true } | { ok: false; error: string };

/**
 * Binds `code` to `action`. If another action holds the key: with `swap` the two
 * trade keys, otherwise the call is refused with an error naming that action.
 */
export async function rebind(
  action: KeybindAction,
  code: string,
  opts: { swap?: boolean } = {},
): Promise<RebindResult> {
  if (!KEY_CODE.test(code)) return { ok: false, error: 'That key can’t be used. Try another one.' };
  if (RESERVED_KEYS.has(code)) return { ok: false, error: `${keyName(code)} is used to walk or close things. Try another key.` };
  const other = actionUsing(state.keybinds, code, action);
  const next = { ...state.keybinds, [action]: code };
  if (other) {
    if (!opts.swap) return { ok: false, error: `${keyName(code)} is already used for ${KEYBIND_LABELS[other].label}.` };
    next[other] = state.keybinds[action];
  }
  return save(next);
}

/** Back to the default keys. */
export function resetKeybinds(): Promise<RebindResult> {
  return save({ ...DEFAULT_KEYBINDS });
}

/** Optimistic save: show the change at once, roll back if the server refuses. */
async function save(next: Keybinds): Promise<RebindResult> {
  const previous = state;
  set({ keybinds: next, loaded: true });
  try {
    const saved = await api<{ keybinds?: unknown }>('/settings', { method: 'PATCH', body: { keybinds: next } });
    if (saved.keybinds) set({ keybinds: normalizeKeybinds(saved.keybinds), loaded: true });
    return { ok: true };
  } catch (err) {
    set(previous);
    return { ok: false, error: err instanceof ApiError ? err.message : 'Could not reach the server.' };
  }
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
function matchesKey(e: KeyboardEvent, action: KeybindAction) {
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
