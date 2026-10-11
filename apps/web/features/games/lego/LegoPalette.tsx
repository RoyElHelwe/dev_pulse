'use client';

/**
 * Palette swatch selector for Lego bricks.
 * Displays available palette colors with selection ring indicators.
 */

import { LEGO_PALETTE } from '@/game/render/legoArt';
import { cn } from '@/lib/cn';

/** Selected color index, active eraser mode flag, and selection callback for choosing brick colors. */
export interface LegoPaletteProps {
  selectedColorIndex: number;
  isErasing: boolean;
  onSelectColor: (index: number) => void;
}

/**
 * Renders selectable color swatch buttons for Lego brick placement.
 */
export function LegoPalette({
  selectedColorIndex,
  isErasing,
  onSelectColor,
}: LegoPaletteProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 py-0.5 shrink-0">
      {LEGO_PALETTE.map((hex, i) => (
        <button
          key={hex}
          type="button"
          title={`Color ${i + 1}`}
          onClick={() => onSelectColor(i)}
          className={cn(
            'size-7 rounded-md transition-transform border border-black/20 hover:scale-110 active:scale-95 cursor-pointer',
            selectedColorIndex === i && !isErasing ? 'ring-2 ring-zinc-900 ring-offset-2 scale-105' : '',
          )}
          style={{ backgroundColor: hex }}
        />
      ))}
    </div>
  );
}
