export type VoiceMode = 'OPEN' | 'PUSH_TO_TALK';

/** GET / PATCH /api/settings. */
export interface VoiceSettings {
  voiceMode: VoiceMode;
  /** KeyboardEvent.code ("KeyV", "Space"...). */
  pushToTalkKey: string;
  keybinds?: Record<string, string>;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = { voiceMode: 'OPEN', pushToTalkKey: 'KeyV' };

/** Same rule as the API. */
export const KEY_CODE = /^[A-Za-z0-9]{1,24}$/;

const NAMES: Record<string, string> = {
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

/** "KeyV" → "V", "Digit1" → "1", "Backquote" → "`", "Numpad0" → "Num 0". */
export function keyName(code: string) {
  if (NAMES[code]) return NAMES[code];
  if (/^(Key|Digit)./.test(code)) return code.replace(/^(Key|Digit)/, '');
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  if (code.startsWith('Arrow')) return `${code.slice(5)} arrow`;
  return code;
}
