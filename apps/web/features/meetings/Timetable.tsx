'use client';

// Interactive timetable grid displaying room schedules across 30-minute intervals.
// Fits into MeetingsPanel as the primary schedule view for booking and reviewing meetings.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Room } from '@/game/layout/types';
import { cn } from '@/lib/cn';
import { type Booking, clockOf, firstName, hm, minutesOf, ROW_MINUTES, rowAt, ROWS, rowTime } from './time';

const ROW_HEIGHT_PX = 28;
const HOURS_PER_HEADER_LABEL = 2;
const LABEL_HALF_HEIGHT_PX = 7;
/** 08:00: where the grid opens on days other than today. */
const DEFAULT_SCROLL_ROW = (8 * 60) / ROW_MINUTES;

interface TimetableProps {
  rooms: Room[];
  day: Date;
  bookings: Booking[];
  now: number;
  myId: string;
  nameOf(userId: string): string;
  /** An empty slot (or a dragged run of slots) was picked: rows [from, to). */
  onPick(roomId: string, from: number, to: number): void;
  onOpen(booking: Booking): void;
  /** Row to scroll into view when the grid opens; defaults to the current time today, 08:00 on other days. */
  scrollRow?: number;
}

/** Timetable grid showing 00:00–24:00 availability per room with drag-to-book and booking details click. */
export function Timetable({ rooms, day, bookings, now, myId, nameOf, onPick, onOpen, scrollRow }: TimetableProps) {
  // Mouse drag over several slots of one room.
  const [drag, setDrag] = useState<{ roomId: string; from: number; to: number } | null>(null);
  const pointer = useRef('');
  useEffect(() => {
    if (!drag) return;
    const up = () => {
      onPick(drag.roomId, Math.min(drag.from, drag.to), Math.max(drag.from, drag.to) + 1);
      setDrag(null);
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [drag, onPick]);

  const rowOf = (at: Date) => rowAt(day, at);
  const nowRow = rowOf(new Date(now));

  // The full day is tall: open on the asked row, else on "now" today and on the working morning other days.
  // Read once on mount (MeetingsPanel remounts the grid per day) so the minute tick never moves the view.
  const rootRef = useRef<HTMLDivElement>(null);
  const [openRow] = useState(() => scrollRow ?? (nowRow > 0 && nowRow < ROWS ? Math.floor(nowRow) : DEFAULT_SCROLL_ROW));
  useLayoutEffect(() => {
    // The panel's scroll area is the grid's parent; leave one row of context above the target.
    const root = rootRef.current;
    const scroller = root?.parentElement;
    if (!root || !scroller) return;
    const gridTop = root.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTop = gridTop + Math.max(0, openRow - 1) * ROW_HEIGHT_PX;
  }, [openRow]);

  return (
    <div ref={rootRef} className="flex min-w-max select-none">
      {/* Hours */}
      <div className="sticky left-0 z-20 w-12 shrink-0 bg-white/90">
        <div className="sticky top-0 h-8 bg-white/90" />
        <div className="relative" style={{ height: ROWS * ROW_HEIGHT_PX }}>
          {/* One label per hour line, 00:00 to 24:00; the first and last are kept inside the column. */}
          {Array.from({ length: ROWS / HOURS_PER_HEADER_LABEL + 1 }, (_, i) => (
            <span
              key={i}
              style={{ top: Math.min(Math.max(i * HOURS_PER_HEADER_LABEL * ROW_HEIGHT_PX - LABEL_HALF_HEIGHT_PX, 0), ROWS * ROW_HEIGHT_PX - 2 * LABEL_HALF_HEIGHT_PX) }}
              className="absolute right-2 text-[11px] text-zinc-400 tabular-nums"
            >
              {/* From minutes, not a Date, so the last line reads 24:00 rather than the next day's 00:00. */}
              {clockOf(minutesOf(rowTime(day, 0)) + i * HOURS_PER_HEADER_LABEL * ROW_MINUTES)}
            </span>
          ))}
        </div>
      </div>

      {rooms.map((room) => {
        const roomBookings = bookings.filter((b) => b.roomId === room.id);
        // Covered slots cannot be clicked, so disable and hide them from accessibility tab order.
        const covered = (row: number) => roomBookings.some((b) => rowOf(new Date(b.startsAt)) < row + 1 && rowOf(new Date(b.endsAt)) > row);
        return (
          <div key={room.id} className="w-36 shrink-0 border-l border-zinc-100 sm:w-40">
            <div className="sticky top-0 z-10 flex h-8 items-center justify-center truncate bg-white/90 px-2 text-sm font-semibold text-zinc-700">
              {room.name}
            </div>
            <div className="relative" style={{ height: ROWS * ROW_HEIGHT_PX }}>
              {Array.from({ length: ROWS }, (_, row) => {
                const past = rowTime(day, row + 1).getTime() <= now;
                const hidden = covered(row);
                const selected = drag?.roomId === room.id && row >= Math.min(drag.from, drag.to) && row <= Math.max(drag.from, drag.to);
                return (
                  <button
                    key={row}
                    type="button"
                    disabled={past || hidden}
                    aria-hidden={hidden || undefined}
                    aria-label={`Book ${room.name} at ${hm(rowTime(day, row))}`}
                    style={{ top: row * ROW_HEIGHT_PX, height: ROW_HEIGHT_PX }}
                    className={cn(
                      'absolute inset-x-0 border-t text-[11px] text-transparent transition',
                      row % 2 ? 'border-dashed border-zinc-100' : 'border-zinc-200/70',
                      // Past slots look blocked: grey hatching and a "not allowed" cursor.
                      past
                        ? 'cursor-not-allowed bg-zinc-100 bg-[image:repeating-linear-gradient(135deg,transparent_0_6px,rgb(0_0_0/0.05)_6px_12px)]'
                        : 'cursor-pointer hover:bg-emerald-50 hover:text-emerald-700',
                      selected && 'bg-emerald-100',
                    )}
                    onPointerDown={(e) => {
                      pointer.current = e.pointerType;
                      if (e.pointerType === 'mouse' && e.button === 0 && !past && !hidden) setDrag({ roomId: room.id, from: row, to: row });
                    }}
                    onPointerEnter={() => {
                      if (drag?.roomId === room.id && !past && !hidden) setDrag({ ...drag, to: row });
                    }}
                    // Touch and keyboard: drag is restricted to mouse so touch devices can freely scroll the grid.
                    onClick={(e) => {
                      if (e.detail === 0 || pointer.current !== 'mouse') onPick(room.id, row, row + 1);
                    }}
                  >
                    {hm(rowTime(day, row))}
                  </button>
                );
              })}

              {roomBookings.map((b) => {
                const from = Math.max(0, rowOf(new Date(b.startsAt)));
                const to = Math.min(ROWS, rowOf(new Date(b.endsAt)));
                if (to <= from) return null;
                const mine = b.attendeeIds.includes(myId);
                const people = b.attendeeIds.map((id) => (id === myId ? 'you' : firstName(nameOf(id))));
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onOpen(b)}
                    style={{ top: from * ROW_HEIGHT_PX + 1, height: (to - from) * ROW_HEIGHT_PX - 2 }}
                    className={cn(
                      'absolute inset-x-1 overflow-hidden rounded-lg px-2 py-1 text-left text-xs leading-tight shadow-sm ring-1 transition hover:brightness-95',
                      mine ? 'bg-emerald-500 text-white ring-emerald-600' : 'bg-zinc-200 text-zinc-800 ring-zinc-300',
                    )}
                  >
                    <span className="block truncate font-semibold">{b.title}</span>
                    <span className="block truncate opacity-80">
                      {hm(new Date(b.startsAt))}–{hm(new Date(b.endsAt))}
                    </span>
                    <span className="block truncate opacity-80">{people.join(', ')}</span>
                  </button>
                );
              })}

              {nowRow > 0 && nowRow < ROWS && (
                <div className="pointer-events-none absolute inset-x-0 h-0.5 bg-rose-500/80" style={{ top: nowRow * ROW_HEIGHT_PX }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
