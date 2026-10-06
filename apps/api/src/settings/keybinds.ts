import { FormError } from '../common/form-error';

export const ACTIONS = [
  'interact',
  'mute',
  'deafen',
  'pushToTalk',
  'chat',
  'board',
  'rooms',
  'people',
] as const;

export type Action = (typeof ACTIONS)[number];

export const DEFAULT_KEYBINDS: Record<Action, string> = {
  interact: 'KeyE',
  mute: 'KeyM',
  deafen: 'KeyH',
  pushToTalk: 'KeyV',
  chat: 'KeyC',
  board: 'KeyB',
  rooms: 'KeyT',
  people: 'KeyP',
};

export const ACTION_LABELS: Record<Action, string> = {
  interact: 'Use / interact',
  mute: 'Mute microphone',
  deafen: 'Deafen',
  pushToTalk: 'Push to talk',
  chat: 'Chat',
  board: 'Task board',
  rooms: 'Rooms & timetable',
  people: 'People list',
};

export const RESERVED = [
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Escape',
  'Enter',
  'Tab',
] as const;

export const RESERVED_KEYS: ReadonlySet<string> = new Set<string>(RESERVED);

export const KEY_CODE = /^[A-Za-z0-9]{1,24}$/;

/** Strips "Key" or "Digit" prefix if followed by a character, else returns raw code. */
export function friendlyKeyName(code: string): string {
  if (/^(Key|Digit)./.test(code)) {
    return code.replace(/^(Key|Digit)/, '');
  }
  return code;
}

/**
 * Returns full keybind map starting with defaults, overlaid with valid stored entries
 * (ignoring unknown/invalid ones), and pushToTalk overridden by the pushToTalkKey column.
 */
export function resolveKeybinds(stored: unknown, pushToTalkKey: string): Record<Action, string> {
  const result: Record<Action, string> = { ...DEFAULT_KEYBINDS };

  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    const record = stored as Record<string, unknown>;
    for (const action of ACTIONS) {
      const val = record[action];
      if (typeof val === 'string' && KEY_CODE.test(val) && !RESERVED_KEYS.has(val)) {
        result[action] = val;
      }
    }
  }

  if (typeof pushToTalkKey === 'string' && KEY_CODE.test(pushToTalkKey)) {
    result.pushToTalk = pushToTalkKey;
  }

  return result;
}

/**
 * Applies proposed changes to the current keybind map.
 * Throws FormError on unknown actions, invalid key codes, reserved keys,
 * or if two actions end up sharing the same key code.
 */
export function applyKeybindChanges(
  current: Record<Action, string>,
  changes: Record<string, unknown>,
): Record<Action, string> {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw new FormError('INVALID_KEYBINDS', 'Keybind changes must be an object.', 'keybinds');
  }

  for (const [action, value] of Object.entries(changes)) {
    if (!ACTIONS.includes(action as Action)) {
      throw new FormError('UNKNOWN_ACTION', `Unknown action: ${action}`, 'keybinds');
    }
    if (typeof value !== 'string' || !KEY_CODE.test(value)) {
      throw new FormError('INVALID_KEY', `Pick a key on your keyboard.`, 'keybinds');
    }
    if (RESERVED_KEYS.has(value)) {
      throw new FormError(
        'RESERVED_KEY',
        `${friendlyKeyName(value)} is used to walk or close things. Try another key.`,
        'keybinds',
      );
    }
  }

  const next: Record<Action, string> = { ...current };
  for (const [action, value] of Object.entries(changes) as [Action, string][]) {
    next[action] = value;
  }

  // Check if any changed action conflicts with another action
  for (const [actionStr, code] of Object.entries(changes) as [Action, string][]) {
    const action = actionStr as Action;
    const other = ACTIONS.find((a) => a !== action && next[a] === code);
    if (other) {
      const key = friendlyKeyName(code);
      const label = ACTION_LABELS[other] ?? other;
      throw new FormError('KEY_CONFLICT', `${key} is already used for ${label}.`, 'keybinds');
    }
  }

  // Also check if any duplicate exists across all actions
  for (const action of ACTIONS) {
    const code = next[action];
    const other = ACTIONS.find((a) => a !== action && next[a] === code);
    if (other) {
      const key = friendlyKeyName(code);
      const label = ACTION_LABELS[other] ?? other;
      throw new FormError('KEY_CONFLICT', `${key} is already used for ${label}.`, 'keybinds');
    }
  }

  return next;
}
