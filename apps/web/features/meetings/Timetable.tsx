'use client';

import { useEffect, useRef, useState } from 'react';
import type { Room } from '@/game/layout/types';
import { cn } from '@/lib/cn';
import { type Booking, firstName, hm, ROW_MINUTES, ROWS, rowTime } from './time';

const ROW_H = 28;

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
}

/** One column per meeting room, 08:00–20:00 in 30-minute rows; click or drag over free slots to book. */
export function Timetable({ rooms, day, bookings, now, myId, nameOf, onPick, onOpen }: TimetableProps) {
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

  const top = rowTime(day, 0).getTime();
  const rowOf = (at: Date) => (at.getTime() - top) / (ROW_MINUTES * 60_000);
  const nowRow = rowOf(new Date(now));

  return (
    <div className="flex min-w-max select-none">
      {/* Hours */}
      <div className="sticky left-0 z-20 w-12 shrink-0 bg-white/90">
        <div className="sticky top-0 h-8 bg-white/90" />
        <div className="relative" style={{ height: ROWS * ROW_H }}>
          {Array.from({ length: ROWS / 2 }, (_, i) => (
            <span key={i} style={{ top: i * 2 * ROW_H - 7 }} className="absolute right-2 text-[11px] text-zinc-400 tabular-nums">
              {i > 0 && hm(rowTime(day, i * 2))}
            </span>
          ))}
        </div>
      </div>

      {rooms.map((room) => {
        const roomBookings = bookings.filter((b) => b.roomId === room.id);
        return (
          <div key={room.id} className="w-36 shrink-0 border-l border-zinc-100 sm:w-40">
            <div className="sticky top-0 z-10 flex h-8 items-center justify-center truncate bg-white/90 px-2 text-sm font-semibold text-zinc-700">
              {room.name}
            </div>
            <div className="relative" style={{ height: ROWS * ROW_H }}>
              {Array.from({ length: ROWS }, (_, row) => {
                const past = rowTime(day, row + 1).getTime() <= now;
                const selected = drag?.roomId === room.id && row >= Math.min(drag.from, drag.to) && row <= Math.max(drag.from, drag.to);
                return (
                  <button
                    key={row}
                    type="button"
                    disabled={past}
                    aria-label={`Book ${room.name} at ${hm(rowTime(day, row))}`}
                    style={{ top: row * ROW_H, height: ROW_H }}
                    className={cn(
                      'absolute inset-x-0 border-t text-[11px] text-transparent transition',
                      row % 2 ? 'border-dashed border-zinc-100' : 'border-zinc-200/70',
                      past ? 'bg-zinc-50/80' : 'hover:bg-emerald-50 hover:text-emerald-700',
                      selected && 'bg-emerald-100',
                    )}
                    onPointerDown={(e) => {
                      pointer.current = e.pointerType;
                      if (e.pointerType === 'mouse' && e.button === 0 && !past) setDrag({ roomId: room.id, from: row, to: row });
                    }}
                    onPointerEnter={() => {
                      if (drag?.roomId === room.id && !past) setDrag({ ...drag, to: row });
                    }}
                    // Touch and keyboard: one tap books one slot (drag is mouse only, so touch can scroll).
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
                    style={{ top: from * ROW_H + 1, height: (to - from) * ROW_H - 2 }}
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
                <div className="pointer-events-none absolute inset-x-0 h-0.5 bg-rose-500/80" style={{ top: nowRow * ROW_H }} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
