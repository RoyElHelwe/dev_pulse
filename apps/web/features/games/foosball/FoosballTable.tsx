'use client';

/**
 * Foosball table display screen.
 * Combines the interactive FoosballCanvas with game HUD overlays, status banners, and rod selection controls.
 */

import { cn } from '@/lib/cn';
import {
  ROD_NAMES,
  type FoosballView,
} from './constants';
import { FoosballCanvas } from './FoosballCanvas';
import { FoosballEnded } from './FoosballEnded';

/** Canvas element ref, authoritative game view, input listeners, and rod switching handler to operate the table. */
export interface FoosballTableProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  view: FoosballView;
  activeRod: number;
  locked: boolean;
  cursorPosRef: React.RefObject<{ x: number; y: number }>;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  selectRod: (rod: number) => void;
  onRematch?: () => void;
}

/**
 * Table view wrapper hosting the canvas playing field, status HUDs, and player rod selector.
 */
export function FoosballTable({
  canvasRef,
  view,
  activeRod,
  locked,
  cursorPosRef,
  onPointerMove,
  onPointerDown,
  selectRod,
  onRematch,
}: FoosballTableProps) {
  const activeRodY = view.you ? (view.rods[view.you.side]?.[activeRod]?.y ?? 0) : 0;

  return (
    <>
      {/* Scalable canvas area with HUD overlays */}
      <FoosballCanvas
        canvasRef={canvasRef}
        view={view}
        activeRod={activeRod}
        youSide={view.you?.side ?? null}
        locked={locked}
        cursorPosRef={cursorPosRef}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
      >
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
          <FoosballEnded
            winner={view.winner}
            score={view.score}
            forfeit={view.forfeit}
            onRematch={onRematch}
          />
        )}
      </FoosballCanvas>

      {/* Slim strip under the canvas: rod chips and mouse hint */}
      <div className="shrink-0 mt-1.5 flex flex-wrap items-center justify-between gap-2 px-2 py-1 text-xs text-zinc-600 rounded-lg border border-zinc-200/80 bg-zinc-50/70">
        {view.you ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-zinc-700 text-[11px]">Active rod:</span>
            <div className="flex items-center gap-1">
              {view.you.rods.map((rod) => (
                <button
                  key={rod}
                  type="button"
                  data-testid={`foosball-rod-${rod}`}
                  onClick={() => selectRod(rod)}
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-medium transition cursor-pointer select-none',
                    rod === activeRod
                      ? 'bg-amber-400 text-zinc-950 font-semibold shadow-xs ring-1 ring-amber-500'
                      : 'bg-white text-zinc-700 hover:bg-zinc-200 ring-1 ring-zinc-200',
                  )}
                >
                  {rod + 1}: {ROD_NAMES[rod]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-zinc-400 italic">
            Spectating match — take a seat above to play
          </div>
        )}

        <div className="text-[11px] text-zinc-500 select-none truncate">
          Move the mouse to move the rod · click a rod to select it · click or flick to kick
        </div>
      </div>

      {/* active-rod-pos for test assertion */}
      <span
        data-testid="active-rod-pos"
        data-y={activeRodY}
        className="hidden"
      />
    </>
  );
}
