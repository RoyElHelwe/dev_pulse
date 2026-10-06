'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { Modal } from '@/components/ui/Modal';
import {
  actionUsing,
  KEY_CODE,
  KEYBIND_ACTIONS,
  KEYBIND_LABELS,
  type KeybindAction,
  rebind,
  RESERVED_KEYS,
  resetKeybinds,
  useKeybinds,
} from '@/features/settings/keybinds';
import { keyName } from '@/features/voice/settings';
import { useEscape } from '@/lib/escape';

const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
]);

function isModifier(e: KeyboardEvent) {
  return MODIFIER_CODES.has(e.code) || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key);
}

export interface KeybindsModalProps {
  open: boolean;
  onClose: () => void;
}

export function KeybindsModal({ open, onClose }: KeybindsModalProps) {
  const keybinds = useKeybinds();
  const [capturingAction, setCapturingAction] = useState<KeybindAction | null>(null);
  const [conflict, setConflict] = useState<{ action: KeybindAction; code: string; other: KeybindAction } | null>(null);
  const [rowError, setRowError] = useState<{ action: KeybindAction; error: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const cancelCapture = useCallback(() => {
    setCapturingAction(null);
  }, []);

  useEscape(Boolean(capturingAction), cancelCapture);

  useEffect(() => {
    if (!capturingAction) return;

    const onKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') return;

      if (isModifier(e)) return;

      e.preventDefault();
      e.stopPropagation();

      const action = capturingAction;
      const code = e.code;
      setCapturingAction(null);

      if (RESERVED_KEYS.has(code)) {
        setRowError({
          action,
          error: `${keyName(code)} is used to walk or close things. Try another key.`,
        });
        return;
      }

      if (!KEY_CODE.test(code)) {
        setRowError({
          action,
          error: 'That key can’t be used. Try another one.',
        });
        return;
      }

      const other = actionUsing(code, action);
      if (other) {
        setConflict({ action, code, other });
        return;
      }

      const res = await rebind(action, code);
      if (!res.ok) {
        setRowError({ action, error: res.error });
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturingAction]);

  useEffect(() => {
    if (!open) {
      setCapturingAction(null);
      setConflict(null);
      setRowError(null);
      setGeneralError(null);
    }
  }, [open]);

  function startCapturing(action: KeybindAction) {
    setCapturingAction(action);
    if (conflict?.action === action) setConflict(null);
    if (rowError?.action === action) setRowError(null);
    setGeneralError(null);
  }

  async function handleSwap(conf: { action: KeybindAction; code: string; other: KeybindAction }) {
    setConflict(null);
    const res = await rebind(conf.action, conf.code, { swap: true });
    if (!res.ok) {
      setRowError({ action: conf.action, error: res.error });
    }
  }

  async function handleReset() {
    setResetting(true);
    setCapturingAction(null);
    setConflict(null);
    setRowError(null);
    setGeneralError(null);
    const res = await resetKeybinds();
    if (!res.ok) {
      setGeneralError(res.error);
    }
    setResetting(false);
  }

  return (
    <Modal open={open} onClose={onClose} title="Keybinds" className="max-w-xl">
      <div className="mt-4 divide-y divide-zinc-100">
        {KEYBIND_ACTIONS.map((action) => {
          const { label, hint } = KEYBIND_LABELS[action];
          const code = keybinds[action];
          const isCapturing = capturingAction === action;
          const isConflicted = conflict?.action === action;
          const error = rowError?.action === action ? rowError.error : null;

          return (
            <div key={action} className="py-2.5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{label}</p>
                  <p className="text-xs text-zinc-500">{hint}</p>
                </div>
                <div className="shrink-0">
                  {isCapturing ? (
                    <span className="text-xs font-medium text-emerald-600 animate-pulse">
                      Press a key… (Esc to cancel)
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startCapturing(action)}
                      className="rounded p-0.5 hover:ring-2 hover:ring-emerald-500/20 focus-visible:outline-2 focus-visible:outline-emerald-500"
                      aria-label={`Change shortcut for ${label}, currently ${keyName(code)}`}
                    >
                      <Kbd>{keyName(code)}</Kbd>
                    </button>
                  )}
                </div>
              </div>

              {isConflicted && conflict && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                  <span>
                    <strong className="font-semibold">{keyName(conflict.code)}</strong> is already used for{' '}
                    <strong className="font-semibold">{KEYBIND_LABELS[conflict.other].label}</strong>.
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => handleSwap(conflict)}
                    >
                      Swap
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => setConflict(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
            </div>
          );
        })}
      </div>

      {generalError && <p className="mt-2 text-xs text-rose-600">{generalError}</p>}

      <div className="mt-5 flex flex-col items-start justify-between gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center">
        <p className="text-xs text-zinc-400">Keys never fire while you type in a text field.</p>
        <Button variant="secondary" size="sm" disabled={resetting} onClick={handleReset}>
          Reset to defaults
        </Button>
      </div>
    </Modal>
  );
}
