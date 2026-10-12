'use client';

// HUD panel and meeting rooms timetable dialog with presence/collision management.
// Fits into OfficeFeatures to coordinate room access permissions and schedule reminders.

import { CalendarClock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonStyles } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import type { OfficeFeatureProps } from '@/features/office/types';
import { canManage } from '@/features/workspace/types';
import { useKeybind, useKeyName } from '@/features/settings/keybindStore';
import { api, ApiError } from '@/lib/api';
import { useEscape } from '@/lib/escape';
import { BookingForm } from './BookingForm';
import { Timetable } from './Timetable';
import { addDays, type Booking, dayLabel, firstName, hm, type Member, minutesOf, ROW_MINUTES, rowAt, ROWS, rowTime, startOfDay } from './time';

const MS_PER_MINUTE = 60_000;
const MEETING_START_ANNOUNCE_WINDOW_MS = 2 * MS_PER_MINUTE;
const MIN_PAST_DAYS_OFFSET = -7;
const MAX_FUTURE_DAYS_OFFSET = 30;
const TIME_POLL_INTERVAL_MS = 10_000;
const BOOKING_FETCH_AHEAD_DAYS = 2;

type View = { kind: 'grid' } | { kind: 'new'; roomId: string; start: number; end: number } | { kind: 'booking'; id: string };

/** Meetings panel component managing room schedules, occupant collisions, and booking dialogs. */
export function MeetingsPanel({ socket, controller, workspace, myId, onToast, editing }: OfficeFeatureProps) {
  const rooms = useMemo(() => workspace.layout.rooms.filter((r) => r.kind === 'meeting'), [workspace.layout]);
  const now = useMinute();
  const today = startOfDay(new Date(now));
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(today);
  const [view, setView] = useState<View>({ kind: 'grid' });
  // Row of the slot or booking last opened, so "Back" returns the grid to the same place.
  const [scrollRow, setScrollRow] = useState<number>();
  const changeDay = (next: Date) => {
    setDay(next);
    setScrollRow(undefined);
  };
  const { bookings, reload } = useBookings(socket, today, day);
  const members = useMembers(open);
  const nameOf = useCallback(
    (id: string) => members.find((m) => m.userId === id)?.displayName ?? bookings.find((b) => b.createdById === id)?.createdByName ?? 'Someone',
    [members, bookings],
  );
  const roomName = useCallback((id: string) => rooms.find((r) => r.id === id)?.name ?? 'This room', [rooms]);

  // Active bookings in meeting rooms covering the current minute.
  const active = useMemo(
    () => bookings.filter((b) => Date.parse(b.startsAt) <= now && now < Date.parse(b.endsAt) && rooms.some((r) => r.id === b.roomId)),
    [bookings, now, rooms],
  );

  // Synchronize room locking and occupancy only when active bookings change to avoid expensive layout recomputations every minute.
  const officeKey = active.map((b) => `${b.roomId}:${b.endsAt}:${b.attendeeIds.includes(myId)}`).join();
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    if (!controller) return;
    const list = activeRef.current;
    controller.setRoomBookings(list.map((b) => ({ roomId: b.roomId, until: hm(new Date(b.endsAt)) })));
    const notMine = list.filter((b) => !b.attendeeIds.includes(myId));
    const movedFrom = controller.setLockedRooms(notMine.map((b) => b.roomId));
    const booking = notMine.find((b) => b.roomId === movedFrom);
    if (booking) onToast(`${roomName(booking.roomId)} is booked until ${hm(new Date(booking.endsAt))}.`);
  }, [controller, officeKey, myId, onToast, roomName]);

  // Announce meeting starts once per booking to avoid repeating toasts across polling updates.
  const announced = useRef(new Set<string>());
  useEffect(() => {
    for (const b of active) {
      if (!b.attendeeIds.includes(myId) || announced.current.has(b.id)) continue;
      announced.current.add(b.id);
      if (now - Date.parse(b.startsAt) < MEETING_START_ANNOUNCE_WINDOW_MS) onToast(`“${b.title}” is starting in ${roomName(b.roomId)}.`);
    }
  }, [active, myId, now, onToast, roomName]);

  // Focus moves into the panel when it opens, and back to the "Rooms" button when it closes.
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);
  const close = () => {
    setOpen(false);
    setView({ kind: 'grid' });
    setScrollRow(undefined);
    buttonRef.current?.focus();
  };
  useKeybind('rooms', () => (open ? close() : setOpen(true)), !editing);
  const roomsKey = useKeyName('rooms');
  useEscape(open && !editing, () => (view.kind === 'grid' ? close() : setView({ kind: 'grid' })));

  const pick = useCallback(
    (roomId: string, from: number, to: number) => {
      const start = minutesOf(rowTime(day, from));
      setScrollRow(from);
      setView({ kind: 'new', roomId, start, end: start + (to - from) * ROW_MINUTES });
    },
    [day],
  );

  // While the office is edited: hidden, but the rules above keep running.
  if (rooms.length === 0 || editing) return null;
  const dayBookings = bookings.filter((b) => Date.parse(b.startsAt) < addDays(day, 1).getTime() && Date.parse(b.endsAt) > day.getTime());
  const selected = view.kind === 'booking' ? bookings.find((b) => b.id === view.id) : undefined;
  const minDay = addDays(today, MIN_PAST_DAYS_OFFSET);
  const maxDay = addDays(today, MAX_FUTURE_DAYS_OFFSET);
  // The last slot of the day has ended: nothing on this day can be booked any more.
  const dayOver = rowTime(day, ROWS).getTime() <= now;

  return (
    <>
      <Panel className="absolute top-[4.5rem] right-4 p-1">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          title={`Rooms (${roomsKey})`}
          aria-expanded={open}
          className={buttonStyles('ghost', 'sm', 'h-9')}
        >
          <CalendarClock className="size-4" /> Rooms
        </button>
      </Panel>

      {open && (
        <Panel
          ref={panelRef}
          role="dialog"
          aria-label="Meeting rooms"
          tabIndex={-1}
          className="absolute inset-x-2 top-[7.75rem] bottom-4 z-30 flex flex-col overflow-hidden outline-none sm:right-4 sm:left-auto sm:w-[min(52rem,calc(100vw-2rem))]"
        >
          <header className="flex items-center gap-1 border-b border-zinc-200/70 py-2 pr-2 pl-4">
            <h2 className="mr-auto font-semibold">Meeting rooms</h2>
            {view.kind === 'grid' && (
              <>
                <IconButton aria-label="Previous day" disabled={day <= minDay} onClick={() => changeDay(addDays(day, -1))}>
                  <ChevronLeft className="size-4" />
                </IconButton>
                <button
                  type="button"
                  onClick={() => changeDay(today)}
                  className="min-w-32 rounded-full px-2 py-1 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-900/5"
                >
                  {dayLabel(day, today)}
                </button>
                <IconButton aria-label="Next day" disabled={day >= maxDay} onClick={() => changeDay(addDays(day, 1))}>
                  <ChevronRight className="size-4" />
                </IconButton>
              </>
            )}
            <IconButton aria-label="Close" onClick={close}>
              <X className="size-4" />
            </IconButton>
          </header>

          <div className="min-h-0 flex-1 overflow-auto">
            {view.kind === 'grid' && (
              <>
                <p className="px-4 pt-3 pb-2 text-xs text-zinc-500">
                  {dayOver
                    ? 'Booking hours for this day are over. Pick a later day with the arrow above to book a room.'
                    : 'Click a free slot, or drag over several, to book. Grey striped slots have passed. During a meeting only its people can enter the room.'}
                </p>
                <Timetable
                  key={day.getTime()}
                  rooms={rooms}
                  day={day}
                  bookings={dayBookings}
                  now={now}
                  myId={myId}
                  nameOf={nameOf}
                  onPick={pick}
                  onOpen={(b) => {
                    setScrollRow(Math.max(0, Math.floor(rowAt(day, new Date(b.startsAt)))));
                    setView({ kind: 'booking', id: b.id });
                  }}
                  scrollRow={scrollRow}
                />
              </>
            )}
            {view.kind === 'new' && (
              <BookingForm
                rooms={rooms}
                day={day}
                roomId={view.roomId}
                start={view.start}
                end={view.end}
                members={members}
                myId={myId}
                onBack={() => setView({ kind: 'grid' })}
                onBooked={() => {
                  setView({ kind: 'grid' });
                  onToast('Room booked.');
                  void reload();
                }}
              />
            )}
            {view.kind === 'booking' && (
              <BookingDetails
                booking={selected}
                roomName={selected ? roomName(selected.roomId) : ''}
                myId={myId}
                canCancel={!!selected && (selected.createdById === myId || canManage(workspace.role)) && Date.parse(selected.endsAt) > now}
                nameOf={nameOf}
                onBack={() => setView({ kind: 'grid' })}
                onCancelled={() => {
                  setView({ kind: 'grid' });
                  onToast('Booking cancelled.');
                  void reload();
                }}
              />
            )}
          </div>
        </Panel>
      )}
    </>
  );
}

function BookingDetails({
  booking,
  roomName,
  myId,
  canCancel,
  nameOf,
  onBack,
  onCancelled,
}: {
  booking: Booking | undefined;
  roomName: string;
  myId: string;
  canCancel: boolean;
  nameOf(id: string): string;
  onBack(): void;
  onCancelled(): void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!booking) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <Alert>This booking was cancelled.</Alert>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    );
  }

  const cancel = async () => {
    if (!window.confirm(`Cancel “${booking.title}”?`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/workspace/bookings/${booking.id}`, { method: 'DELETE' });
      onCancelled();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const start = new Date(booking.startsAt);
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="text-lg font-semibold">{booking.title}</h3>
        <p className="text-sm text-zinc-600">
          {roomName} · {start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · {hm(start)}–
          {hm(new Date(booking.endsAt))}
        </p>
        <p className="text-sm text-zinc-500">Booked by {booking.createdById === myId ? 'you' : booking.createdByName}</p>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium text-zinc-800">People ({booking.attendeeIds.length})</p>
        <ul className="flex flex-wrap gap-1.5">
          {booking.attendeeIds.map((id) => (
            <li key={id} className="rounded-full bg-zinc-100 px-2.5 py-1 text-sm text-zinc-700">
              {id === myId ? 'You' : firstName(nameOf(id))}
            </li>
          ))}
        </ul>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        {canCancel && (
          <Button variant="secondary" loading={busy} onClick={cancel} className="text-rose-700">
            Cancel booking
          </Button>
        )}
      </div>
    </div>
  );
}

function useMinute() {
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / MS_PER_MINUTE) * MS_PER_MINUTE);
  useEffect(() => {
    const timer = setInterval(() => setMinute(Math.floor(Date.now() / MS_PER_MINUTE) * MS_PER_MINUTE), TIME_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return minute;
}

function useBookings(socket: Socket | null, today: Date, day: Date) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const from = Math.min(today.getTime(), day.getTime());
  const to = Math.max(addDays(today, BOOKING_FETCH_AHEAD_DAYS).getTime(), addDays(day, 1).getTime());

  const reload = useCallback(async () => {
    const query = `from=${new Date(from).toISOString()}&to=${new Date(to).toISOString()}`;
    const list = await api<Booking[]>(`/workspace/bookings?${query}`).catch(() => null);
    if (list) setBookings(list);
  }, [from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => void reload();
    socket.on('office:bookings', refresh);
    socket.on('connect', refresh);
    return () => {
      socket.off('office:bookings', refresh);
      socket.off('connect', refresh);
    };
  }, [socket, reload]);

  return { bookings, reload };
}

function useMembers(open: boolean) {
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    if (!open) return;
    api<Member[]>('/workspace/members').then(setMembers, () => undefined);
  }, [open]);
  return members;
}
