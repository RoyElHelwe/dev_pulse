'use client';

/**
 * Edge grab handle for dragging or toggling the task board drawer open and shut.
 * Positioned on the right screen edge or following the drawer panel.
 */

import { forwardRef, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface BoardDrawerHandleProps {
  open: boolean;
  onPointerDown(e: PointerEvent<HTMLButtonElement>): void;
  onPointerMove(e: PointerEvent<HTMLButtonElement>): void;
  onPointerUp(e: PointerEvent<HTMLButtonElement>): void;
  onPointerCancel(e: PointerEvent<HTMLButtonElement>): void;
  onClick(): void;
}

/** Renders the touch-friendly tab button used to drag or toggle the task board drawer. */
export const BoardDrawerHandle = forwardRef<HTMLButtonElement, BoardDrawerHandleProps>(
  function BoardDrawerHandle(
    { open, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={open ? 'Close task board' : 'Open task board'}
        aria-expanded={open}
        title={open ? 'Drag or click to close' : 'Drag or click to open the task board'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={onClick}
        className={cn(
          'absolute top-1/2 right-0 z-40 flex h-20 w-5 -translate-y-1/2 cursor-grab touch-none items-center justify-center',
          'rounded-l-xl border border-r-0 border-zinc-200 bg-white/95 text-zinc-500 shadow-md select-none',
          'hover:bg-white hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-emerald-500 active:cursor-grabbing',
        )}
      >
        {open ? (
          <ChevronRight className="size-4" aria-hidden="true" />
        ) : (
          <ChevronLeft className="size-4" aria-hidden="true" />
        )}
      </button>
    );
  },
);
