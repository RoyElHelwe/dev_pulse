/**
 * Wild card color selection modal component.
 * Allows the active player to choose the next suit color after playing a wild card.
 */

'use client';

import { Button } from '@/components/ui/Button';
import type { Color } from './types';

interface UnoColorPickerProps {
  onSelectColor: (color: Color) => void;
  onCancel: () => void;
}

/**
 * Renders the color selection options for wild card plays.
 */
export function UnoColorPicker({ onSelectColor, onCancel }: UnoColorPickerProps) {
  return (
    <div className="shrink-0 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg flex flex-col items-center gap-2">
      <span className="text-xs font-semibold text-zinc-800">
        Choose a colour for wild card:
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="uno-color-red"
          aria-label="Choose red"
          onClick={() => onSelectColor('red')}
          className="h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 active:scale-95 transition-all shadow-xs cursor-pointer"
        >
          Red
        </button>
        <button
          type="button"
          data-testid="uno-color-yellow"
          aria-label="Choose yellow"
          onClick={() => onSelectColor('yellow')}
          className="h-8 px-3 rounded-lg bg-yellow-400 text-zinc-950 text-xs font-bold hover:bg-yellow-500 active:scale-95 transition-all shadow-xs cursor-pointer"
        >
          Yellow
        </button>
        <button
          type="button"
          data-testid="uno-color-green"
          aria-label="Choose green"
          onClick={() => onSelectColor('green')}
          className="h-8 px-3 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 active:scale-95 transition-all shadow-xs cursor-pointer"
        >
          Green
        </button>
        <button
          type="button"
          data-testid="uno-color-blue"
          aria-label="Choose blue"
          onClick={() => onSelectColor('blue')}
          className="h-8 px-3 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-xs cursor-pointer"
        >
          Blue
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
