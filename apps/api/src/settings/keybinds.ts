/**
 * Keybind configuration, defaults, and validation rules for avatar controls and shortcuts.
 * Resolves persisted user keybindings and validates updates against reserved navigation keys.
 */

import { FormError } from '../common/form-error';

/** Maximum character length permitted for a KeyboardEvent.code string. */
const MAX_KEY_CODE_CHARS = 24;

/** Supported user-customizable action identifiers across the virtual office. */
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

/** Union type of all bindable action identifiers. */
export type Action = (typeof ACTIONS)[number];

/** Legacy keybind actions that are deprecated and silently ignored to support older clients. */
export const LEGACY_ACTIONS = ['foosKick', 'foosSwitch'] as const;

/** Default physical keybindings for new users. */
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

const ACTION_LABELS: Record<Action, string> = {
  interact: 'Use / interact',
  mute: 'Mute microphone',
  deafen: 'Deafen',
  pushToTalk: 'Push to talk',
  chat: 'Chat',
  board: 'Task board',
  rooms: 'Rooms & timetable',
  people: 'People list',
};

/** Keys reserved for avatar walking (WASD, Arrows) and UI navigation (Escape, Enter, Tab). */
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

const RESERVED_KEYS: ReadonlySet<string> = new Set<string>(RESERVED);

const KEY_CODE = new RegExp(`^[A-Za-z0-9]{1,${MAX_KEY_CODE_CHARS}}$`);

/** Formats a raw KeyboardEvent.code (e.g. "KeyE" -> "E") for user-facing conflict messages. */
export function friendlyKeyName(code: string): string {
  if (/^(Key|Digit)./.test(code)) {
    return code.replace(/^(Key|Digit)/, '');
  }
  return code;
}

/** Merges database-stored keybinds and dedicated pushToTalkKey with defaults, ignoring corrupted records. */
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

  // pushToTalkKey is mirrored in its own database column; valid non-empty values take precedence.
  if (typeof pushToTalkKey === 'string' && KEY_CODE.test(pushToTalkKey)) {
    result.pushToTalk = pushToTalkKey;
  }

  return result;
}

/** Validates proposed keybind updates, rejecting reserved keys and duplicates across actions. */
export function applyKeybindChanges(
  current: Record<Action, string>,
  changes: Record<string, unknown>,
): Record<Action, string> {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw new FormError('INVALID_KEYBINDS', 'Keybind changes must be an object.', 'keybinds');
  }

  // Silently ignore removed actions so payload sync from older cached client builds succeeds.
  const filteredChanges: Record<string, unknown> = {};
  for (const [action, value] of Object.entries(changes)) {
    if ((LEGACY_ACTIONS as readonly string[]).includes(action)) continue;
    filteredChanges[action] = value;
  }

  for (const [action, value] of Object.entries(filteredChanges)) {
    if (!ACTIONS.includes(action as Action)) {
      throw new FormError('UNKNOWN_ACTION', `Unknown action: ${action}`, 'keybinds');
    }
    if (typeof value !== 'string' || !KEY_CODE.test(value)) {
      throw new FormError('INVALID_KEY', `Pick a key on your keyboard.`, 'keybinds');
    }
    // Prevent overriding movement keys or core UI controls to avoid trapping the user.
    if (RESERVED_KEYS.has(value)) {
      throw new FormError(
        'RESERVED_KEY',
        `${friendlyKeyName(value)} is used to walk or close things. Try another key.`,
        'keybinds',
      );
    }
  }

  const next: Record<Action, string> = { ...current };
  for (const [action, value] of Object.entries(filteredChanges) as [Action, string][]) {
    next[action] = value;
  }

  // Validate that no proposed change conflicts with existing or other proposed actions.
  for (const [actionStr, code] of Object.entries(filteredChanges) as [Action, string][]) {
    const action = actionStr as Action;
    const other = ACTIONS.find((a) => a !== action && next[a] === code);
    if (other) {
      const key = friendlyKeyName(code);
      const label = ACTION_LABELS[other] ?? other;
      throw new FormError('KEY_CONFLICT', `${key} is already used for ${label}.`, 'keybinds');
    }
  }

  // Ensure invariant: each action must map to a unique physical key across the entire layout.
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

