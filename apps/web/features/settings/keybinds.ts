// What can be rebound: the actions, their defaults, labels, and which keys are allowed.
// Pure data and functions; the live per-user state is in keybindStore.ts.
// Mirror of apps/api/src/settings/keybinds.ts (defaults and key rules): change both together.

export const KEYBIND_ACTIONS = ['interact', 'mute', 'deafen', 'pushToTalk', 'chat', 'board', 'rooms', 'people'] as const;
export type KeybindAction = (typeof KEYBIND_ACTIONS)[number];
export type Keybinds = Record<KeybindAction, string>;

/** Same defaults as the API. Values are KeyboardEvent.code, so they do not depend on the layout. */
export const DEFAULT_KEYBINDS: Keybinds = {
  interact: 'KeyE',
  mute: 'KeyM',
  deafen: 'KeyH',
  pushToTalk: 'KeyV',
  chat: 'KeyC',
  board: 'KeyB',
  rooms: 'KeyT',
  people: 'KeyP',
};

/** Name and one-line hint shown in the Keybinds modal. */
export const KEYBIND_LABELS: Record<KeybindAction, { label: string; hint: string }> = {
  interact: { label: 'Use / interact', hint: 'Sit, open your desk, claim a desk' },
  mute: { label: 'Mute microphone', hint: 'While in voice' },
  deafen: { label: 'Deafen', hint: 'While in voice' },
  pushToTalk: { label: 'Push to talk', hint: 'Hold to talk (push-to-talk mode)' },
  chat: { label: 'Chat', hint: 'Open or close the chat panel' },
  board: { label: 'Task board', hint: 'Drop the Kanban board down or up' },
  rooms: { label: 'Rooms & timetable', hint: 'Open or close the meeting rooms' },
  people: { label: 'People list', hint: 'Open or close who is here' },
};

/** Keys that walk, close or confirm: never bindable. */
export const RESERVED_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', 'Enter', 'Tab',
]);

/** Shape of a valid key code (same rule as the API). */
export const KEY_CODE = /^[A-Za-z0-9]{1,24}$/;

/** Server data (or garbage) -> a complete Keybinds: invalid or missing entries fall back to the defaults. */
export function normalizeKeybinds(raw: unknown): Keybinds {
  const out = { ...DEFAULT_KEYBINDS };
  if (raw && typeof raw === 'object') {
    for (const action of KEYBIND_ACTIONS) {
      const value = (raw as Record<string, unknown>)[action];
      if (typeof value === 'string' && KEY_CODE.test(value)) out[action] = value;
    }
  }
  return out;
}

/** The action in `keybinds` that already uses `code`, if any (other than `except`). */
export function actionUsing(keybinds: Keybinds, code: string, except?: KeybindAction): KeybindAction | null {
  return KEYBIND_ACTIONS.find((a) => a !== except && keybinds[a] === code) ?? null;
}
