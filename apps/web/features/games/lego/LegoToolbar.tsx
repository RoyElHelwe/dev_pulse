'use client';

/**
 * Top toolbar for the Lego wall panel.
 * Contains shape selectors, rotation trigger, erase tool toggle, and board clearing confirmation.
 */

import { useState } from 'react';
import { Eraser, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { LEGO_BASE_SHAPES } from '@/game/render/legoArt';

export interface LegoToolbarProps {
  selectedShapeIndex: number;
  isErasing: boolean;
  canClear: boolean;
  onSelectShape: (index: number) => void;
  onRotate: () => void;
  onToggleErase: () => void;
  onClear: () => void;
}

/**
 * Renders Lego brick shapes, tools, and board administrative controls.
 */
export function LegoToolbar({
  selectedShapeIndex,
  isErasing,
  canClear,
  onSelectShape,
  onRotate,
  onToggleErase,
  onClear,
}: LegoToolbarProps) {
  const [confirmingClear, setConfirmingClear] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 pb-2 shrink-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {LEGO_BASE_SHAPES.map(([sw, sh], idx) => {
          const isSelected = selectedShapeIndex === idx && !isErasing;
          return (
            <Button
              key={`${sw}x${sh}`}
              variant={isSelected ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => onSelectShape(idx)}
            >
              {sw}×{sh}
            </Button>
          );
        })}

        <Button
          variant="secondary"
          size="sm"
          onClick={onRotate}
          title="Rotate brick (R)"
        >
          <RotateCw className="size-3.5" />
          <span>Rotate</span>
          <Kbd className="ml-0.5">R</Kbd>
        </Button>

        <div className="mx-1 h-5 w-px bg-zinc-200" />

        <Button
          variant={isErasing ? 'primary' : 'secondary'}
          size="sm"
          onClick={onToggleErase}
          className={isErasing ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          title="Erase brick"
        >
          <Eraser className="size-3.5" />
          <span>Erase</span>
        </Button>
      </div>

      {canClear && (
        <div className="flex items-center gap-1.5">
          {confirmingClear ? (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-zinc-600 font-medium">Clear board?</span>
              <Button
                variant="primary"
                size="sm"
                className="h-8 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  onClear();
                  setConfirmingClear(false);
                }}
              >
                Yes, clear
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setConfirmingClear(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setConfirmingClear(true)}
            >
              <Trash2 className="size-3.5" />
              <span>Clear</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
