'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  BALL_R,
  CANVAS_H,
  CANVAS_W,
  FIELD_L,
  FIELD_W,
  KICK_REACH,
  MAN_R,
  manYs,
  OFFSET_X,
  OFFSET_Y,
  ROD_X_A,
  ROD_X_B,
  SCALE,
  SIDE_COLORS,
  type FoosballSide,
  type FoosballView,
  type RodView,
} from './constants';

interface Snapshot {
  ball: { x: number; y: number; vx: number; vy: number };
  rods: { A: RodView[]; B: RodView[] };
  receivedAt: number;
}

interface StaticRodConfig {
  side: FoosballSide;
  idx: number;
  x: number;
}

// Precomputed rod draw order by x coordinate once outside draw()
const STATIC_RODS_ORDER: readonly StaticRodConfig[] = [
  ...ROD_X_A.map((x, idx) => ({ side: 'A' as const, idx, x })),
  ...ROD_X_B.map((x, idx) => ({ side: 'B' as const, idx, x })),
].sort((a, b) => a.x - b.x);

export interface FoosballCanvasProps {
  stageRef?: React.RefObject<HTMLDivElement | null>;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  view: FoosballView;
  activeRod: number;
  youSide: FoosballSide | null;
  locked?: boolean;
  cursorPosRef?: React.RefObject<{ x: number; y: number }>;
  onPointerMove?: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  onRematch?: () => void;
}

export function FoosballCanvas({
  stageRef,
  canvasRef,
  view,
  activeRod,
  youSide,
  locked = false,
  cursorPosRef,
  onPointerMove,
  onPointerDown,
  onRematch,
}: FoosballCanvasProps) {
  const internalStageRef = useRef<HTMLDivElement | null>(null);
  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const effectiveStageRef = stageRef ?? internalStageRef;
  const effectiveCanvasRef = canvasRef ?? internalCanvasRef;

  const [tableSize, setTableSize] = useState({
    w: CANVAS_W,
    h: CANVAS_H,
    bw: CANVAS_W,
    bh: CANVAS_H,
  });

  const prevSnapshotRef = useRef<Snapshot | null>(null);
  const currSnapshotRef = useRef<Snapshot | null>(null);
  const viewRef = useRef<FoosballView>(view);
  const activeRodRef = useRef(activeRod);
  activeRodRef.current = activeRod;
  const youSideRef = useRef(youSide);
  youSideRef.current = youSide;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  // Track latest view and snapshots without restarting the rAF loop
  useEffect(() => {
    viewRef.current = view;
    prevSnapshotRef.current = currSnapshotRef.current;
    currSnapshotRef.current = {
      ball: { ...view.ball },
      rods: {
        A: view.rods.A.map((r) => ({ ...r })),
        B: view.rods.B.map((r) => ({ ...r })),
      },
      receivedAt: performance.now(),
    };
  }, [view]);

  // ResizeObserver on the stage: largest 7:4 box that fits
  useEffect(() => {
    const stage = effectiveStageRef.current;
    if (!stage) return;

    const updateSize = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      const aspect = CANVAS_W / CANVAS_H; // 7 / 4 = 1.75
      let w = width;
      let h = width / aspect;
      if (h > height) {
        h = height;
        w = height * aspect;
      }
      w = Math.max(1, Math.floor(w));
      h = Math.max(1, Math.floor(h));

      // Test browsers without a GPU set `__devpulseLowRes`: half resolution keeps the page responsive.
      const lowRes = typeof window !== 'undefined' && (window as unknown as { __devpulseLowRes?: boolean }).__devpulseLowRes;
      const dpr = lowRes ? 0.5 : Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
      const bw = Math.max(1, Math.round(w * dpr));
      const bh = Math.max(1, Math.round(h * dpr));

      setTableSize({ w, h, bw, bh });
    };

    const rect = stage.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      updateSize(rect.width, rect.height);
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        updateSize(width, height);
      }
    });

    ro.observe(stage);
    return () => ro.disconnect();
  }, [effectiveStageRef]);

  // ONE persistent requestAnimationFrame loop reading refs
  useEffect(() => {
    const canvas = effectiveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const now = performance.now();
      const curr = currSnapshotRef.current;
      const prev = prevSnapshotRef.current;
      const v = viewRef.current;

      let ballX = v.ball.x;
      let ballY = v.ball.y;
      let rodsA = v.rods.A;
      let rodsB = v.rods.B;

      if (curr) {
        if (prev && now < curr.receivedAt) {
          const dt = Math.max(1, curr.receivedAt - prev.receivedAt);
          const alpha = Math.min(1, Math.max(0, (now - prev.receivedAt) / dt));
          ballX = prev.ball.x + alpha * (curr.ball.x - prev.ball.x);
          ballY = prev.ball.y + alpha * (curr.ball.y - prev.ball.y);
          rodsA = curr.rods.A.map((cr, i) => {
            const pr = prev.rods.A[i] ?? cr;
            return { y: pr.y + alpha * (cr.y - pr.y), kick: pr.kick + alpha * (cr.kick - pr.kick) };
          });
          rodsB = curr.rods.B.map((cr, i) => {
            const pr = prev.rods.B[i] ?? cr;
            return { y: pr.y + alpha * (cr.y - pr.y), kick: pr.kick + alpha * (cr.kick - pr.kick) };
          });
        } else {
          const elapsedSec = Math.min(0.1, Math.max(0, (now - curr.receivedAt) / 1000));
          ballX = curr.ball.x + curr.ball.vx * elapsedSec;
          ballY = curr.ball.y + curr.ball.vy * elapsedSec;
          rodsA = curr.rods.A;
          rodsB = curr.rods.B;
        }
      }

      ballY = Math.max(BALL_R, Math.min(FIELD_W - BALL_R, ballY));
      ballX = Math.max(-8, Math.min(FIELD_L + 8, ballX));

      // Reset transform and clear backing size
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Set scale transform so draw() operates in logical coordinates
      const k = canvas.width / CANVAS_W;
      ctx.setTransform(k, 0, 0, k, 0, 0);

      draw(ctx, {
        ballX,
        ballY,
        rodsA,
        rodsB,
        activeRod: activeRodRef.current,
        youSide: youSideRef.current,
        cursor: cursorPosRef?.current ?? null,
        isLocked: lockedRef.current,
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [cursorPosRef, effectiveCanvasRef]);

  return (
    <div
      ref={effectiveStageRef}
      data-testid="foosball-canvas"
      data-locked={locked ? 'true' : 'false'}
      className="relative flex-1 min-h-0 w-full flex items-center justify-center select-none touch-none overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
    >
      <div
        data-locked={locked ? 'true' : 'false'}
        className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-lg select-none touch-none shrink-0"
        style={{
          width: `${tableSize.w}px`,
          height: `${tableSize.h}px`,
        }}
      >
        <canvas
          ref={effectiveCanvasRef}
          width={tableSize.bw}
          height={tableSize.bh}
          onContextMenu={(e) => e.preventDefault()}
          className="block w-full h-full select-none touch-none"
        />

        {/* Top Score Banner */}
        <div data-testid="foosball-score" className="pointer-events-none absolute top-2 inset-x-0 flex justify-center">
          <div className="flex items-center gap-3 rounded-full bg-zinc-900/85 px-4 py-1 text-xs font-semibold backdrop-blur-xs shadow-md border border-zinc-700/60">
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="size-2 rounded-full bg-blue-500" />
              Left
            </span>
            <span className="font-mono text-base font-bold text-white tracking-wider">
              {view.score.A} - {view.score.B}
            </span>
            <span className="flex items-center gap-1.5 text-red-400">
              Right
              <span className="size-2 rounded-full bg-red-500" />
            </span>
          </div>
        </div>

        {/* Forfeit grace timer banner */}
        {view.graceLeft !== null && view.graceLeft > 0 && (
          <div className="pointer-events-none absolute top-12 inset-x-0 flex justify-center">
            <div className="rounded-md bg-amber-500/90 px-3 py-1 text-xs font-semibold text-zinc-950 shadow-md animate-pulse">
              Player left — match ends in {view.graceLeft}s
            </div>
          </div>
        )}

        {/* Countdown overlay */}
        {view.phase === 'countdown' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/35 backdrop-blur-[1px]">
            <span className="font-mono text-6xl font-black text-amber-300 drop-shadow-md animate-bounce">
              {view.countdown}
            </span>
            <span className="mt-1 text-xs font-bold tracking-widest uppercase text-white/80">
              Get Ready!
            </span>
          </div>
        )}

        {/* GOAL! Flash overlay */}
        {view.phase === 'goal' && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/30 backdrop-blur-[1px]">
            <span className="text-5xl font-black italic tracking-wider text-amber-400 drop-shadow-[0_4px_12px_rgba(250,204,21,0.6)] animate-pulse">
              GOAL!
            </span>
          </div>
        )}

        {/* Winner overlay */}
        {view.phase === 'ended' && (
          <div
            data-testid="foosball-ended-overlay"
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          >
            <div className="flex flex-col items-center rounded-xl border border-zinc-700 bg-zinc-900/95 p-5 text-center shadow-2xl">
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Match Ended
              </div>
              <div className="text-xl font-bold text-white mb-1">
                {view.winner === 'A' ? 'Team Left (Blue)' : view.winner === 'B' ? 'Team Right (Red)' : 'Draw'} Won!
              </div>
              {view.forfeit && <span className="text-xs text-amber-400 font-medium mb-3">Won by forfeit</span>}
              <div className="font-mono text-sm text-zinc-300 mb-4">
                Final: {view.score.A} - {view.score.B}
              </div>
              {onRematch && (
                <Button variant="primary" size="sm" onClick={onRematch}>
                  Rematch
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function draw(
  ctx: CanvasRenderingContext2D,
  data: {
    ballX: number;
    ballY: number;
    rodsA: RodView[];
    rodsB: RodView[];
    activeRod: number;
    youSide: FoosballSide | null;
    cursor: { x: number; y: number } | null;
    isLocked: boolean;
  },
) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Outer frame & Pitch
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(0, 0, CANVAS_W, CANVAS_H, 12);
  } else {
    ctx.rect(0, 0, CANVAS_W, CANVAS_H);
  }
  ctx.fill();

  const pw = FIELD_L * SCALE;
  const ph = FIELD_W * SCALE;
  ctx.fillStyle = '#15803d';
  ctx.fillRect(OFFSET_X, OFFSET_Y, pw, ph);

  // Field markings
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(OFFSET_X, OFFSET_Y, pw, ph);

  const midX = OFFSET_X + pw / 2;
  ctx.beginPath();
  ctx.moveTo(midX, OFFSET_Y);
  ctx.lineTo(midX, OFFSET_Y + ph);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(midX, OFFSET_Y + ph / 2, 10 * SCALE, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.beginPath();
  ctx.arc(midX, OFFSET_Y + ph / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Goals
  ctx.fillStyle = '#09090b';
  ctx.strokeStyle = '#ffffff';
  for (const gx of [OFFSET_X - 24, OFFSET_X + pw]) {
    ctx.fillRect(gx, OFFSET_Y + 20 * SCALE, 24, 24 * SCALE);
    ctx.strokeRect(gx, OFFSET_Y + 20 * SCALE, 24, 24 * SCALE);
  }

  // Rods (precomputed sorted order)
  for (const rod of STATIC_RODS_ORDER) {
    const rx = OFFSET_X + rod.x * SCALE;
    const isActive = data.youSide === rod.side && data.activeRod === rod.idx;
    const v = (rod.side === 'A' ? data.rodsA[rod.idx] : data.rodsB[rod.idx]) ?? { y: 0, kick: 0 };

    if (isActive) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(rx, OFFSET_Y - 8);
      ctx.lineTo(rx, OFFSET_Y + ph + 8);
      ctx.stroke();
    }
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rx, OFFSET_Y - 12);
    ctx.lineTo(rx, OFFSET_Y + ph + 12);
    ctx.stroke();
    ctx.fillStyle = rod.side === 'A' ? '#1d4ed8' : '#b91c1c';
    ctx.fillRect(rx - 3, rod.side === 'A' ? OFFSET_Y + ph + 12 : OFFSET_Y - 24, 6, 12);

    const reach = (rod.side === 'A' ? 1 : -1) * (v.kick || 0) * KICK_REACH * SCALE;
    const manColor = rod.side === 'A' ? SIDE_COLORS.A.primary : SIDE_COLORS.B.primary;

    for (const my of manYs(rod.idx, v.y)) {
      const mx = rx + reach;
      const cy = OFFSET_Y + my * SCALE;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(mx + 1.5, cy + 1.5, MAN_R * SCALE, 0, Math.PI * 2);
      ctx.fill();

      if (isActive) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(mx, cy, MAN_R * SCALE + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = manColor;
      ctx.beginPath();
      ctx.arc(mx, cy, MAN_R * SCALE, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if ((v.kick || 0) > 0.05) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(mx + (rod.side === 'A' ? 5 : -5), cy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Ball
  const bx = OFFSET_X + data.ballX * SCALE;
  const by = OFFSET_Y + data.ballY * SCALE;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.arc(bx + 2, by + 2, BALL_R * SCALE, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(bx, by, BALL_R * SCALE, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(bx, by, 2, 0, Math.PI * 2);
  ctx.fill();

  // Small ring cursor when pointer lock is active
  if (data.isLocked && data.cursor) {
    ctx.beginPath();
    ctx.arc(data.cursor.x, data.cursor.y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(data.cursor.x, data.cursor.y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}