'use client';

/**
 * Slide-out drawer containing the task board, shifting the office layer in tandem.
 * Wraps the workspace office and provides gesture-based edge sliding.
 */

import {
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { BoardDrawerHandle } from './BoardDrawerHandle';

const SMALL_SCREEN_BREAKPOINT_PX = 768;
const MAX_PANEL_WIDTH_PX = 960;
const PANEL_GAP_PX = 20;
const PANEL_GAP_SMALL_PX = 8;
const SNAP_THRESHOLD_RATIO = 0.35;
const FLICK_VELOCITY_PX_PER_MS = 0.5;
const ANIMATION_DURATION_MS = 340;
const SHADOW_TRAVEL_PX = 56;
const DRAG_MOVE_THRESHOLD_PX = 4;
const FLICK_MAX_PAUSE_MS = 100;
const LINGER_BUFFER_MS = 150;
const SETTLE_BUFFER_MS = 300;
const DEFAULT_VIEWPORT_WIDTH_PX = 1280;
const EASE_TRANSITION = `transform ${ANIMATION_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
const FOCUSABLE_SELECTOR = 'button, a[href], input, select, textarea, summary, [tabindex]';

/** Slides the task board into view as a floating card while pushing office content off-screen. */
export function BoardDrawer({
  open,
  onOpenChange,
  drawer,
  onPush,
  children,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  drawer: ReactNode;
  onPush?(shift: number): void;
  children: ReactNode;
}) {
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT_WIDTH_PX);
  const [dragging, setDragging] = useState(false);
  const small = viewport < SMALL_SCREEN_BREAKPOINT_PX;
  const gap = small ? PANEL_GAP_SMALL_PX : PANEL_GAP_PX;
  const width = small ? viewport - 2 * gap : Math.min(MAX_PANEL_WIDTH_PX, Math.round(viewport * 0.7));
  const travel = width + gap;
  const push = width + 2 * gap;
  const hasDrawer = !!drawer;

  // The board is rendered only while visible: open, actively dragged, or sliding shut.
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

  const place = useCallback(
    (p: number, animate: boolean) => {
      const transition = animate && !reduced.current ? EASE_TRANSITION : 'none';
      for (const [el, transform] of [
        [office.current, `translate3d(${-p * push}px,0,0)`],
        [panel.current, `translate3d(${(1 - p) * (travel + SHADOW_TRAVEL_PX)}px,0,0)`],
        [handle.current, `translate3d(${-p * travel}px,0,0)`],
      ] as const) {
        if (!el) continue;
        el.style.transition = transition;
        el.style.transform = transform;
      }
      if (handle.current) {
        handle.current.style.opacity = small ? String(1 - p) : '1';
        handle.current.style.pointerEvents = small && p > 0.5 ? 'none' : 'auto';
      }
    },
    [push, travel, small],
  );

  const releaseOffscreen = useCallback(() => {
    for (const el of inerted.current) el.removeAttribute('inert');
    inerted.current = [];
  }, []);

  const inertOffscreen = useCallback(() => {
    releaseOffscreen();
    for (const el of office.current?.querySelectorAll(FOCUSABLE_SELECTOR) ?? []) {
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
    const timer = setTimeout(() => setLingering(false), ANIMATION_DURATION_MS + LINGER_BUFFER_MS);
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
      layer?.addEventListener('transitionend', arrived);
      settle.current = setTimeout(inertOffscreen, ANIMATION_DURATION_MS + SETTLE_BUFFER_MS);
    }
    onPush?.(shown ? -push / 2 : 0);
    return () => {
      clearTimeout(settle.current);
      layer?.removeEventListener('transitionend', arrived);
    };
  }, [open, hasDrawer, push, onPush, inertOffscreen, releaseOffscreen]);

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
    if (!d.moved && Math.abs(e.clientX - d.x) < DRAG_MOVE_THRESHOLD_PX) return;
    if (!d.moved) releaseOffscreen();
    d.moved = true;
    d.v = (e.clientX - d.last) / Math.max(1, e.timeStamp - d.at);
    d.last = e.clientX;
    d.at = e.timeStamp;
    place(Math.min(1, Math.max(0, d.startP + (d.x - e.clientX) / travel)), false);
  };

  const up = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d?.moved) return;
    suppressClick.current = true;
    const p = progress();
    const v = e.timeStamp - d.at > FLICK_MAX_PAUSE_MS ? 0 : d.v;
    const next =
      Math.abs(v) > FLICK_VELOCITY_PX_PER_MS
        ? v < 0
        : d.startP > 0.5
          ? p > 1 - SNAP_THRESHOLD_RATIO
          : p > SNAP_THRESHOLD_RATIO;
    place(next ? 1 : 0, true);
    if (next !== open) onOpenChange(next);
    else if (next) settle.current = setTimeout(inertOffscreen, ANIMATION_DURATION_MS + SETTLE_BUFFER_MS);
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
            style={{
              top: gap,
              right: gap,
              bottom: gap,
              width,
              transform: `translate3d(${travel + SHADOW_TRAVEL_PX}px,0,0)`,
            }}
            inert={!open && !dragging ? true : undefined}
            aria-hidden={!open && !dragging}
          >
            {showBoard ? drawer : null}
          </aside>

          <BoardDrawerHandle
            ref={handle}
            open={open}
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
          />
        </>
      )}
    </>
  );
}
