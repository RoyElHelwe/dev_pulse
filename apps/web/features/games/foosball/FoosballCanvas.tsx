'use client';

/**
 * Canvas rendering container for Foosball.
 * Manages the high-frequency requestAnimationFrame loop, snapshot interpolation, and responsive resizing.
 */

import { useEffect, useRef, useState } from 'react';
import { devLowRes } from '@/features/dev/devHooks';
import {
  BALL_R,
  CANVAS_H,
  CANVAS_W,
  FIELD_L,
  FIELD_W,
  type FoosballSide,
  type FoosballView,
  type RodView,
} from './constants';
import { drawFoosballScene } from './foosballDraw';

/** Aspect ratio of the table playing surface (560 / 320 = 1.75). */
const TABLE_ASPECT_RATIO = CANVAS_W / CANVAS_H;

/** Maximum extrapolation duration in seconds when extrapolating between server ticks (100 ms). */
const MAX_EXTRAPOLATION_S = 0.1;

/** Device pixel ratio used when running in headless / GPU-less test runners. */
const LOW_RES_DPR = 0.5;

/** Maximum device pixel ratio cap for canvas buffer backing resolution. */
const MAX_DEVICE_PIXEL_RATIO = 2;

/** Field bounds padding allowed during goal trajectories in units. */
const BALL_OOB_LIMIT_UNITS = 8;

interface Snapshot {
  ball: { x: number; y: number; vx: number; vy: number };
  rods: { A: RodView[]; B: RodView[] };
  receivedAt: number;
}

/** Canvas refs, match state snapshot, player rod assignments, and pointer handlers for table control. */
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
  children?: React.ReactNode;
}

/**
 * Manages canvas context, ResizeObserver, and smooth 60fps interpolation rendering.
 */
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
  children,
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

  // ResizeObserver on the stage: maintains the 7:4 aspect ratio within available bounds
  useEffect(() => {
    const stage = effectiveStageRef.current;
    if (!stage) return;

    const updateSize = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      let w = width;
      let h = width / TABLE_ASPECT_RATIO;
      if (h > height) {
        h = height;
        w = height * TABLE_ASPECT_RATIO;
      }
      w = Math.max(1, Math.floor(w));
      h = Math.max(1, Math.floor(h));

      // Test browsers without a GPU ask for half resolution so the page stays responsive.
      const dpr = devLowRes()
        ? LOW_RES_DPR
        : Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, MAX_DEVICE_PIXEL_RATIO);
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
          const elapsedSec = Math.min(MAX_EXTRAPOLATION_S, Math.max(0, (now - curr.receivedAt) / 1000));
          ballX = curr.ball.x + curr.ball.vx * elapsedSec;
          ballY = curr.ball.y + curr.ball.vy * elapsedSec;
          rodsA = curr.rods.A;
          rodsB = curr.rods.B;
        }
      }

      ballY = Math.max(BALL_R, Math.min(FIELD_W - BALL_R, ballY));
      ballX = Math.max(-BALL_OOB_LIMIT_UNITS, Math.min(FIELD_L + BALL_OOB_LIMIT_UNITS, ballX));

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const k = canvas.width / CANVAS_W;
      ctx.setTransform(k, 0, 0, k, 0, 0);

      drawFoosballScene(ctx, {
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
        {children}
      </div>
    </div>
  );
}
