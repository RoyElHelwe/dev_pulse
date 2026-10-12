'use client';

/**
 * Interactive HTML5 canvas element for viewing and placing Lego bricks.
 * Handles pointer move, leave, context menu suppression, and brick placing/erasing.
 */

import { useEffect, useRef, useState } from 'react';
import { brickAt, type LegoBrick, validatePlacement } from '@/game/render/legoArt';
import { cn } from '@/lib/cn';
import { getStudCoordsFromPointer } from './legoBoardGeometry';
import { renderLegoCanvas } from './legoCanvasRenderer';
import {
  BOARD_HEIGHT_STUDS,
  BOARD_WIDTH_STUDS,
  MOUSE_BUTTON_PRIMARY,
  MOUSE_BUTTON_SECONDARY,
} from './legoConstants';

/** Container ref, grid cell sizing in pixels, placed bricks, selected brush properties, and placement callbacks. */
export interface LegoBoardCanvasProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  cellSize: number;
  bricks: LegoBrick[];
  effectiveShape: [number, number];
  colorIndex: number;
  isErasing: boolean;
  onPlaceBrick: (x: number, y: number, w: number, h: number, c: number) => void;
  onRemoveBrick: (x: number, y: number) => void;
  onError: (message: string) => void;
}

/**
 * Renders the Lego baseplate canvas and coordinates pointer interactions for building.
 */
export function LegoBoardCanvas({
  containerRef,
  cellSize,
  bricks,
  effectiveShape,
  colorIndex,
  isErasing,
  onPlaceBrick,
  onRemoveBrick,
  onError,
}: LegoBoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverPos, setHoverPos] = useState<[number, number] | null>(null);

  const canvasWidth = BOARD_WIDTH_STUDS * cellSize;
  const canvasHeight = BOARD_HEIGHT_STUDS * cellSize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    renderLegoCanvas({
      ctx,
      canvas,
      dpr,
      cellSize,
      bricks,
      hoverPos,
      effectiveShape,
      colorIndex,
      isErasing,
    });
  }, [bricks, hoverPos, effectiveShape, colorIndex, isErasing, cellSize]);

  const getStudCoords = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return getStudCoordsFromPointer(
      e.clientX,
      e.clientY,
      canvas.getBoundingClientRect(),
      BOARD_WIDTH_STUDS,
      BOARD_HEIGHT_STUDS,
    );
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setHoverPos(getStudCoords(e));
  };

  const handlePointerLeave = () => {
    setHoverPos(null);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getStudCoords(e);
    if (!coords) return;
    const [x, y] = coords;

    const isRightClick = e.button === MOUSE_BUTTON_SECONDARY;
    const isShift = e.shiftKey;

    if (isRightClick || isShift || isErasing) {
      const target = brickAt(bricks, x, y);
      if (target) {
        onRemoveBrick(x, y);
      }
      return;
    }

    if (e.button !== MOUSE_BUTTON_PRIMARY) return;

    const [w, h] = effectiveShape;
    const brick: LegoBrick = [x, y, w, h, colorIndex];
    const validationErr = validatePlacement(bricks, brick);
    if (validationErr) {
      onError(validationErr);
      return;
    }

    onPlaceBrick(x, y, w, h, colorIndex);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden"
    >
      <div
        className="relative overflow-hidden rounded-xl border border-zinc-300 bg-zinc-900 shadow-inner"
        style={{ width: canvasWidth, height: canvasHeight }}
      >
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{ width: canvasWidth, height: canvasHeight }}
          className={cn(
            'block touch-none select-none',
            isErasing ? 'cursor-not-allowed' : 'cursor-crosshair',
          )}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onPointerDown={handlePointerDown}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
}
