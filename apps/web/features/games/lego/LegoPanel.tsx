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

export default function LegoPanel({ objectId, name, socket, onClose }: GamePanelProps) {
  const { state, status, error, send, leave } = useGameSession<LegoState>(socket, 'lego', objectId);

  const [shapeIndex, setShapeIndex] = useState(1); // default 1x2
  const [rotated, setRotated] = useState(false);
  const [colorIndex, setColorIndex] = useState(4); // default red
  const [isErasing, setIsErasing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<[number, number] | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    const renderW = 768;
    const renderH = 512;

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
        const cx = (x + 0.5) * 16;
        const cy = (y + 0.5) * 16;

        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.arc(cx, cy + 0.5, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Existing bricks
    const bricks = state?.bricks ?? [];
    for (const [bxStud, byStud, bwStud, bhStud, c] of bricks) {
      const colorHex = LEGO_PALETTE[c] ?? LEGO_PALETTE[0];
      const px = bxStud * 16;
      const py = byStud * 16;
      const pw = bwStud * 16;
      const ph = bhStud * 16;

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
          const cx = (bxStud + sx + 0.5) * 16;
          const cy = (byStud + sy + 0.5) * 16;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.beginPath();
          ctx.arc(cx, cy + 0.8, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = colorHex;
          ctx.beginPath();
          ctx.arc(cx, cy, 3.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(cx, cy, 3.8, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.beginPath();
          ctx.arc(cx - 1, cy - 1, 1.4, 0, Math.PI * 2);
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
          ctx.fillRect(tx * 16, ty * 16, tw * 16, th * 16);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.strokeRect(tx * 16, ty * 16, tw * 16, th * 16);
        } else {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.fillRect(hx * 16, hy * 16, 16, 16);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(hx * 16, hy * 16, 16, 16);
        }
      } else {
        const [w, h] = effectiveShape;
        const ghostBrick: LegoBrick = [hx, hy, w, h, colorIndex];
        const validationError = validatePlacement(bricks, ghostBrick);
        const isValid = validationError === null;

        const gx = hx * 16;
        const gy = hy * 16;
        const gw = w * 16;
        const gh = h * 16;

        if (isValid) {
          const colorHex = LEGO_PALETTE[colorIndex] ?? LEGO_PALETTE[0];
          ctx.fillStyle = hexToRgba(colorHex, 0.65);
          ctx.fillRect(gx, gy, gw, gh);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(gx, gy, gw, gh);

          for (let sx = 0; sx < w; sx++) {
            for (let sy = 0; sy < h; sy++) {
              const cx = (hx + sx + 0.5) * 16;
              const cy = (hy + sy + 0.5) * 16;
              ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
              ctx.beginPath();
              ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
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
              const cx = (hx + sx + 0.5) * 16;
              const cy = (hy + sy + 0.5) * 16;
              ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
              ctx.beginPath();
              ctx.arc(cx, cy, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }

    ctx.restore();
  }, [state?.bricks, hoverPos, effectiveShape, colorIndex, isErasing]);

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

  const handleLeave = () => {
    leave();
    onClose();
  };

  const builderCount = state?.players?.length ?? 0;

  return (
    <div data-captures-keys="" className="flex flex-col gap-3.5 select-none">
      {/* Top Header / Info */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-900">{name}</span>
          <span>(48×32 Baseplate)</span>
          {builderCount > 0 && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
              {builderCount} {builderCount === 1 ? 'builder' : 'builders'}
            </span>
          )}
        </div>
        <div>
          {status === 'joining' && <span className="text-zinc-400">Connecting...</span>}
          {status === 'error' && <span className="text-red-500">Connection error</span>}
        </div>
      </div>

      {/* Toolbar: Shapes, Rotate, Erase, Clear */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
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
      <div className="flex flex-wrap items-center gap-1.5 py-1">
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
        <div className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg transition">
          {briefError}
        </div>
      )}

      {/* Lego Canvas */}
      <div className="relative w-full max-w-[768px] overflow-hidden rounded-xl border border-zinc-300 bg-zinc-900 shadow-inner">
        <canvas
          ref={canvasRef}
          width={768}
          height={512}
          className={cn(
            'block w-full aspect-[48/32] touch-none select-none',
            isErasing ? 'cursor-not-allowed' : 'cursor-crosshair',
          )}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onPointerDown={handlePointerDown}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Footer Hints & Leave */}
      <div className="flex items-center justify-between pt-1 text-xs text-zinc-500">
        <span>Click to place. Right-click or Shift-click to erase. Press R to rotate.</span>
        <Button variant="secondary" size="sm" onClick={handleLeave}>
          Leave wall
        </Button>
      </div>
    </div>
  );
}
