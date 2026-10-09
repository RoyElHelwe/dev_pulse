'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import {
  brickAt,
  LEGO_BASE_SHAPES,
  LEGO_H,
  LEGO_PALETTE,
  LEGO_W,
  legoArt,
  type LegoBrick,
  validatePlacement,
} from '@/game/render/legoArt';
import { cn } from '@/lib/cn';
import { useGameChromeInfo } from '../GameChrome';
import type { GamePanelProps } from '../types';
import { useGameSession } from '../useGameSession';

export interface LegoState {
  ready?: boolean;
  w?: number;
  h?: number;
  bricks: LegoBrick[];
  canClear: boolean;
  players: string[];
  version: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function LegoPanel({ objectId, socket }: GamePanelProps) {
  const { state, status, error, send } = useGameSession<LegoState>(socket, 'lego', objectId);

  useGameChromeInfo({
    players: state?.players ? state.players.length : null,
  });

  const [shapeIndex, setShapeIndex] = useState(1); // default 1x2
  const [rotated, setRotated] = useState(false);
  const [colorIndex, setColorIndex] = useState(4); // default red
  const [isErasing, setIsErasing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<[number, number] | null>(null);
  const [cellSize, setCellSize] = useState(16);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Measure available container space to compute square cell size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCellSize = (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      const computed = Math.floor(Math.min(w / LEGO_W, h / LEGO_H));
      setCellSize(Math.max(8, computed));
    };

    const rect = container.getBoundingClientRect();
    updateCellSize(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        updateCellSize(width, height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Mirror state.bricks into legoArt.set(objectId, bricks) so the wall updates instantly
  useEffect(() => {
    if (state?.bricks) {
      legoArt.set(objectId, state.bricks);
    }
  }, [objectId, state?.bricks]);

  // Brief errors
  const showBriefError = useCallback((msg: string) => {
    setBriefError(msg);
  }, []);

  useEffect(() => {
    if (error) {
      setBriefError(error.message || error.code);
    }
  }, [error]);

  useEffect(() => {
    if (briefError) {
      const timer = setTimeout(() => setBriefError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [briefError]);

  // Keyboard shortcut 'R' for rotation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setRotated((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const [bw, bh] = LEGO_BASE_SHAPES[shapeIndex];
  const effectiveShape: [number, number] = rotated ? [bh, bw] : [bw, bh];

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const studSize = cellSize;
    const renderW = LEGO_W * studSize;
    const renderH = LEGO_H * studSize;

    if (canvas.width !== Math.round(renderW * dpr) || canvas.height !== Math.round(renderH * dpr)) {
      canvas.width = Math.round(renderW * dpr);
      canvas.height = Math.round(renderH * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Green baseplate background
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, renderW, renderH);

    // Baseplate studs
    for (let x = 0; x < LEGO_W; x++) {
      for (let y = 0; y < LEGO_H; y++) {
        const cx = (x + 0.5) * studSize;
        const cy = (y + 0.5) * studSize;

        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.arc(cx, cy + studSize * 0.03, studSize * 0.16, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(cx, cy, studSize * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Existing bricks
    const bricks = state?.bricks ?? [];
    for (const [bxStud, byStud, bwStud, bhStud, c] of bricks) {
      const colorHex = LEGO_PALETTE[c] ?? LEGO_PALETTE[0];
      const px = bxStud * studSize;
      const py = byStud * studSize;
      const pw = bwStud * studSize;
      const ph = bhStud * studSize;

      ctx.fillStyle = colorHex;
      ctx.fillRect(px, py, pw, ph);

      // Bevel / edge highlights
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(px, py, pw, 1);
      ctx.fillRect(px, py, 1, ph);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(px, py + ph - 1, pw, 1);
      ctx.fillRect(px + pw - 1, py, 1, ph);

      // Studs on the brick
      for (let sx = 0; sx < bwStud; sx++) {
        for (let sy = 0; sy < bhStud; sy++) {
          const cx = (bxStud + sx + 0.5) * studSize;
          const cy = (byStud + sy + 0.5) * studSize;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.beginPath();
          ctx.arc(cx, cy + studSize * 0.05, studSize * 0.25, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = colorHex;
          ctx.beginPath();
          ctx.arc(cx, cy, studSize * 0.24, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.lineWidth = Math.max(0.5, studSize * 0.05);
          ctx.beginPath();
          ctx.arc(cx, cy, studSize * 0.24, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.beginPath();
          ctx.arc(cx - studSize * 0.06, cy - studSize * 0.06, studSize * 0.09, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Hover ghost
    if (hoverPos) {
      const [hx, hy] = hoverPos;

      if (isErasing) {
        const target = brickAt(bricks, hx, hy);
        if (target) {
          const [tx, ty, tw, th] = target;
          ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.fillRect(tx * studSize, ty * studSize, tw * studSize, th * studSize);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.strokeRect(tx * studSize, ty * studSize, tw * studSize, th * studSize);
        } else {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.fillRect(hx * studSize, hy * studSize, studSize, studSize);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(hx * studSize, hy * studSize, studSize, studSize);
        }
      } else {
        const [w, h] = effectiveShape;
        const ghostBrick: LegoBrick = [hx, hy, w, h, colorIndex];
        const validationError = validatePlacement(bricks, ghostBrick);
        const isValid = validationError === null;

        const gx = hx * studSize;
        const gy = hy * studSize;
        const gw = w * studSize;
        const gh = h * studSize;

        if (isValid) {
          const colorHex = LEGO_PALETTE[colorIndex] ?? LEGO_PALETTE[0];
          ctx.fillStyle = hexToRgba(colorHex, 0.65);
          ctx.fillRect(gx, gy, gw, gh);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(gx, gy, gw, gh);

          for (let sx = 0; sx < w; sx++) {
            for (let sy = 0; sy < h; sy++) {
              const cx = (hx + sx + 0.5) * studSize;
              const cy = (hy + sy + 0.5) * studSize;
              ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
              ctx.beginPath();
              ctx.arc(cx, cy, studSize * 0.22, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
          ctx.fillRect(gx, gy, gw, gh);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.strokeRect(gx, gy, gw, gh);

          for (let sx = 0; sx < w; sx++) {
            for (let sy = 0; sy < h; sy++) {
              const cx = (hx + sx + 0.5) * studSize;
              const cy = (hy + sy + 0.5) * studSize;
              ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
              ctx.beginPath();
              ctx.arc(cx, cy, studSize * 0.19, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }

    ctx.restore();
  }, [state?.bricks, hoverPos, effectiveShape, colorIndex, isErasing, cellSize]);

  const getStudCoords = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const rawX = Math.floor(((e.clientX - rect.left) / rect.width) * LEGO_W);
    const rawY = Math.floor(((e.clientY - rect.top) / rect.height) * LEGO_H);
    if (rawX < 0 || rawX >= LEGO_W || rawY < 0 || rawY >= LEGO_H) return null;
    return [rawX, rawY];
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

    const isRightClick = e.button === 2;
    const isShift = e.shiftKey;

    if (isRightClick || isShift || isErasing) {
      const target = brickAt(state?.bricks ?? [], x, y);
      if (target) {
        send({ type: 'remove', x, y });
      }
      return;
    }

    if (e.button !== 0) return;

    const [w, h] = effectiveShape;
    const brick: LegoBrick = [x, y, w, h, colorIndex];
    const validationErr = validatePlacement(state?.bricks ?? [], brick);
    if (validationErr) {
      showBriefError(validationErr);
      return;
    }

    send({ type: 'place', x, y, w, h, c: colorIndex });
  };

  const canvasWidth = LEGO_W * cellSize;
  const canvasHeight = LEGO_H * cellSize;

  return (
    <div
      data-captures-keys=""
      className="flex h-full w-full min-h-0 flex-col gap-2 p-3 sm:p-4 select-none overflow-hidden"
    >
      {/* Toolbar: Shapes, Rotate, Erase, Clear */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 pb-2 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {LEGO_BASE_SHAPES.map(([sw, sh], idx) => {
            const isSelected = shapeIndex === idx && !isErasing;
            return (
              <Button
                key={`${sw}x${sh}`}
                variant={isSelected ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  setShapeIndex(idx);
                  setIsErasing(false);
                }}
              >
                {sw}×{sh}
              </Button>
            );
          })}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRotated((r) => !r)}
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
            onClick={() => setIsErasing((e) => !e)}
            className={isErasing ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
            title="Erase brick"
          >
            <Eraser className="size-3.5" />
            <span>Erase</span>
          </Button>
        </div>

        {/* Clear Button (Owner/Admin only) */}
        {state?.canClear && (
          <div className="flex items-center gap-1.5">
            {confirmingClear ? (
              <div className="flex items-center gap-1 text-xs">
                <span className="text-zinc-600 font-medium">Clear board?</span>
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    send({ type: 'clear' });
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

      {/* Palette Swatches */}
      <div className="flex flex-wrap items-center gap-1.5 py-0.5 shrink-0">
        {LEGO_PALETTE.map((hex, i) => (
          <button
            key={hex}
            type="button"
            title={`Color ${i + 1}`}
            onClick={() => {
              setColorIndex(i);
              setIsErasing(false);
            }}
            className={cn(
              'size-7 rounded-md transition-transform border border-black/20 hover:scale-110 active:scale-95 cursor-pointer',
              colorIndex === i && !isErasing ? 'ring-2 ring-zinc-900 ring-offset-2 scale-105' : '',
            )}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>

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

      {/* Footer Hints */}
      <div className="flex items-center justify-between pt-1 text-xs text-zinc-500 shrink-0">
        <span>Click to place. Right-click or Shift-click to erase. Press R to rotate.</span>
      </div>
    </div>
  );
}