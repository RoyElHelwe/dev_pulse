'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type PointerEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/** Below this the board takes the whole screen (inset by a thin margin) instead of a ~70% card. */
const SMALL_PX = 768;
const MAX_PX = 960;
const GAP = 20;
const GAP_SMALL = 8;
/** Past this share of the way open, a released drag snaps open (and a drag back snaps shut below 1 - this). */
const SNAP = 0.35;
/** px/ms: a quick flick wins over the position. */
const FLICK = 0.5;
const MS = 340;
const EASE = `transform ${MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
/** Extra travel so the closed board's shadow is fully off-screen. */
const SHADOW = 56;
const FOCUSABLE = 'button, a[href], input, select, textarea, summary, [tabindex]';

/**
 * The task board lives just off-screen on the right. Opening it slides it in as a floating card (inset from the
 * screen borders) and pushes the WHOLE office layer (canvas + every HUD element) to the left by the same motion,
 * so things really leave the screen and come back when it closes. Nothing is resized. A grab handle on the right
 * edge drags it open or shut, following the pointer.
 */
export function BoardDrawer({
  open,
  onOpenChange,
  drawer,
  onPush,
  children,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The board (null while the office editor is open: no handle, no board). */
  drawer: ReactNode;
  /** The office was pushed (or brought back): CSS px the view should shift so the player stays visible. */
  onPush?(shift: number): void;
  /** The office layer: canvas and HUD. */
  children: ReactNode;
}) {
  const [viewport, setViewport] = useState(1280);
  const [dragging, setDragging] = useState(false);
  const small = viewport < SMALL_PX;
  const gap = small ? GAP_SMALL : GAP;
  const width = small ? viewport - 2 * gap : Math.min(MAX_PX, Math.round(viewport * 0.7));
  const travel = width + gap; // how far the handle (and a drag) moves
  const push = width + 2 * gap; // how far the office is pushed: the board's width plus a gap each side
  const hasDrawer = !!drawer;
  // The board is only rendered while it can be seen: open, being dragged, or still sliding shut.
  const [lingering, setLingering] = useState(false);
  const showBoard = open || dragging || lingering;

  const office = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const reduced = useRef(false);
  const suppressClick = useRef(false);
  const drag = useRef<{ x: number; at: number; startP: number; last: number; v: number; moved: boolean } | null>(null);
  const inerted = useRef<Element[]>([]);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sync = () => setViewport(window.innerWidth);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  /** Everything that moves is placed imperatively, so a drag never re-renders the office 60 times a second. */
  const place = useCallback(
    (p: number, animate: boolean) => {
      const transition = animate && !reduced.current ? EASE : 'none';
      for (const [el, transform] of [
        [office.current, `translate3d(${-p * push}px,0,0)`],
        [panel.current, `translate3d(${(1 - p) * (travel + SHADOW)}px,0,0)`],
        [handle.current, `translate3d(${-p * travel}px,0,0)`],
      ] as const) {
        if (!el) continue;
        el.style.transition = transition;
        el.style.transform = transform;
      }
      if (handle.current) {
        // On a phone the board covers the handle: its own close button takes over.
        handle.current.style.opacity = small ? String(1 - p) : '1';
        handle.current.style.pointerEvents = small && p > 0.5 ? 'none' : 'auto';
      }
    },
    [push, travel, small],
  );

  /** Pushed-off HUD must not be reachable by keyboard or screen reader either. */
  const releaseOffscreen = useCallback(() => {
    for (const el of inerted.current) el.removeAttribute('inert');
    inerted.current = [];
  }, []);
  const inertOffscreen = useCallback(() => {
    releaseOffscreen();
    for (const el of office.current?.querySelectorAll(FOCUSABLE) ?? []) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.right <= 0 || r.left >= window.innerWidth) {
        el.setAttribute('inert', '');
        inerted.current.push(el);
      }
    }
  }, [releaseOffscreen]);

  useEffect(() => {
    if (open || dragging) {
      setLingering(true);
      return;
    }
    const timer = setTimeout(() => setLingering(false), MS + 150);
    return () => clearTimeout(timer);
  }, [open, dragging]);

  useLayoutEffect(() => {
    if (!drag.current) place(open && hasDrawer ? 1 : 0, true);
  }, [open, hasDrawer, place]);

  useEffect(() => {
    clearTimeout(settle.current);
    releaseOffscreen();
    const shown = open && hasDrawer;
    const layer = office.current;
    const arrived = (e: TransitionEvent) => {
      if (e.target === layer) inertOffscreen();
    };
    if (shown) {
      // When the slide has really finished (a busy frame can delay it past the timer, which is only a fallback).
      layer?.addEventListener('transitionend', arrived);
      settle.current = setTimeout(inertOffscreen, MS + 300);
    }
    onPush?.(shown ? -push / 2 : 0);
    return () => {
      clearTimeout(settle.current);
      layer?.removeEventListener('transitionend', arrived);
    };
  }, [open, hasDrawer, push, onPush, inertOffscreen, releaseOffscreen]);

  /** 0..1, read from where the handle really is (also right while it is still animating). */
  const progress = () => {
    const r = handle.current?.getBoundingClientRect();
    return r ? Math.min(1, Math.max(0, (window.innerWidth - r.right) / travel)) : 0;
  };

  const down = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, at: e.timeStamp, startP: progress(), last: e.clientX, v: 0, moved: false };
    setDragging(true);
  };

  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.x) < 4) return;
    if (!d.moved) releaseOffscreen();
    d.moved = true;
    d.v = (e.clientX - d.last) / Math.max(1, e.timeStamp - d.at); // negative = moving left = opening
    d.last = e.clientX;
    d.at = e.timeStamp;
    place(Math.min(1, Math.max(0, d.startP + (d.x - e.clientX) / travel)), false);
  };

  const up = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d?.moved) return; // a plain click: onClick toggles
    suppressClick.current = true;
    const p = progress();
    // A pause before letting go cancels the flick: only the last moments of the gesture count.
    const v = e.timeStamp - d.at > 100 ? 0 : d.v;
    const next = Math.abs(v) > FLICK ? v < 0 : d.startP > 0.5 ? p > 1 - SNAP : p > SNAP;
    place(next ? 1 : 0, true);
    if (next !== open) onOpenChange(next);
    else if (next) settle.current = setTimeout(inertOffscreen, MS + 300);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <>
      <div ref={office} className="absolute inset-0">
        {children}
      </div>

      {hasDrawer && (
        <>
          <aside
            ref={panel}
            aria-label="Task board drawer"
            className="absolute z-30 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 shadow-2xl shadow-zinc-900/25"
            style={{ top: gap, right: gap, bottom: gap, width, transform: `translate3d(${travel + SHADOW}px,0,0)` }}
            inert={!open && !dragging ? true : undefined}
            aria-hidden={!open && !dragging}
          >
            {showBoard ? drawer : null}
          </aside>

          {/* The grab handle: on the screen edge while closed, riding the board's left edge while open. */}
          <button
            ref={handle}
            type="button"
            aria-label={open ? 'Close task board' : 'Open task board'}
            aria-expanded={open}
            title={open ? 'Drag or click to close' : 'Drag or click to open the task board'}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onClick={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              onOpenChange(!open);
            }}
            className={cn(
              'absolute top-1/2 right-0 z-40 flex h-20 w-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center',
              'rounded-l-xl border border-r-0 border-zinc-200 bg-white/95 text-zinc-500 shadow-md select-none',
              'hover:bg-white hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-emerald-500 active:cursor-grabbing',
            )}
          >
            {open ? <ChevronRight className="size-4" aria-hidden="true" /> : <ChevronLeft className="size-4" aria-hidden="true" />}
          </button>
        </>
      )}
    </>
  );
}
