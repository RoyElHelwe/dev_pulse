// Configuration types, default values, and key display formatters for proximity voice.
// Fits into the voice feature and settings UI to support open mic and push-to-talk modes.

/** Microphone transmission activation strategy, choosing between continuous open voice and push-to-talk keybind. */
export type VoiceMode = 'OPEN' | 'PUSH_TO_TALK';

/** GET / PATCH /api/settings voice payload. */
export interface VoiceSettings {
  voiceMode: VoiceMode;
  /** KeyboardEvent.code ("KeyV", "Space"...). */
  pushToTalkKey: string;
  keybinds?: Record<string, string>;
}

/** Fallback audio transmission preferences configuring open-mic activation and KeyV push-to-talk keybind. */
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = { voiceMode: 'OPEN', pushToTalkKey: 'KeyV' };

const KEY_DISPLAY_NAMES: Record<string, string> = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  ControlLeft: 'Left Ctrl',
  ControlRight: 'Right Ctrl',
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  AltLeft: 'Left Alt',
  AltRight: 'Right Alt',
  CapsLock: 'Caps Lock',
};

/** Formats a KeyboardEvent.code into a user-friendly display string ("KeyV" → "V"). */
export function keyName(code: string) {
  if (KEY_DISPLAY_NAMES[code]) return KEY_DISPLAY_NAMES[code];
  if (/^(Key|Digit)./.test(code)) return code.replace(/^(Key|Digit)/, '');
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  if (code.startsWith('Arrow')) return `${code.slice(5)} arrow`;
  return code;
}
