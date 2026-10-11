'use client';

/**
 * Main panel component for the collaborative Lego wall mini-game.
 * Composes toolbar controls, color palette swatches, board canvas, and status messages.
 */

import type { GamePanelProps } from '../types';
import { LegoBoardCanvas } from './LegoBoardCanvas';
import { LegoPalette } from './LegoPalette';
import { LegoToolbar } from './LegoToolbar';
import { useLegoBoard } from './useLegoBoard';

/**
 * Lego builder workspace panel mounted inside GameHost dialogs.
 */
export default function LegoPanel({ objectId, socket }: GamePanelProps) {
  const {
    state,
    status,
    briefError,
    cellSize,
    containerRef,
    effectiveShape,
    shapeIndex,
    isRotated,
    colorIndex,
    isErasing,
    showBriefError,
    selectShape,
    toggleRotate,
    toggleErasing,
    selectColor,
    placeBrick,
    removeBrick,
    clearBoard,
  } = useLegoBoard(objectId, socket);

  return (
    <div
      data-captures-keys=""
      className="flex h-full w-full min-h-0 flex-col gap-2 p-3 sm:p-4 select-none overflow-hidden"
    >
      {/* Toolbar: Shapes, Rotate, Erase, Clear */}
      <LegoToolbar
        selectedShapeIndex={shapeIndex}
        isErasing={isErasing}
        canClear={Boolean(state?.canClear)}
        onSelectShape={selectShape}
        onRotate={toggleRotate}
        onToggleErase={toggleErasing}
        onClear={clearBoard}
      />

      {/* Palette Swatches */}
      <LegoPalette
        selectedColorIndex={colorIndex}
        isErasing={isErasing}
        onSelectColor={selectColor}
      />

      {/* Brief Error Banner */}
      {briefError && (
        <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg transition shrink-0">
          {briefError}
        </div>
      )}

      {/* Connection State Info (if joining or error) */}
      {status === 'joining' && !state && (
        <div className="text-xs text-zinc-400 py-1 shrink-0">Connecting to Lego wall...</div>
      )}
      {status === 'error' && !state && (
        <div className="text-xs text-red-500 py-1 shrink-0">Connection error</div>
      )}

      {/* Lego Canvas Container */}
      <LegoBoardCanvas
        containerRef={containerRef}
        cellSize={cellSize}
        bricks={state?.bricks ?? []}
        effectiveShape={effectiveShape}
        colorIndex={colorIndex}
        isErasing={isErasing}
        onPlaceBrick={placeBrick}
        onRemoveBrick={removeBrick}
        onError={showBriefError}
      />

      {/* Footer Hints */}
      <div className="flex items-center justify-between pt-1 text-xs text-zinc-500 shrink-0">
        <span>Click to place. Right-click or Shift-click to erase. Press R to rotate.</span>
      </div>
    </div>
  );
}
