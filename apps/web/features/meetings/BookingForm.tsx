'use client';

// Modal form for scheduling meeting room reservations and inviting attendees.
// Fits into MeetingsPanel as the creation sub-view when empty time slots are selected.

import { type FormEvent, useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import type { Room } from '@/game/layout/types';
import { api, ApiError } from '@/lib/api';
import { atMinutes, clockOf, MAX_MINUTES, type Member, STEP_MINUTES } from './time';

const MINUTES_PER_DAY = 24 * 60;
const MAX_TITLE_LENGTH_CHARS = 80;
const MEMBER_FILTER_THRESHOLD_COUNT = 8;

const STEPS = Array.from({ length: MINUTES_PER_DAY / STEP_MINUTES + 1 }, (_, i) => i * STEP_MINUTES);

interface BookingFormProps {
  rooms: Room[];
  day: Date;
  /** Prefilled from the picked slots (minutes after midnight). */
  roomId: string;
  start: number;
  end: number;
  members: Member[];
  myId: string;
  onBooked(): void;
  onBack(): void;
}

/** Renders the booking creation form for selecting title, room, duration, and invited members. */
export function BookingForm({ rooms, day, members, myId, onBooked, onBack, ...initial }: BookingFormProps) {
  const [title, setTitle] = useState('');
  const [roomId, setRoomId] = useState(initial.roomId);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(Math.min(initial.end, initial.start + MAX_MINUTES));
  const [invited, setInvited] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const others = useMemo(
    () => members.filter((m) => m.userId !== myId && m.displayName.toLowerCase().includes(filter.trim().toLowerCase())),
    [members, myId, filter],
  );

  const changeStart = (value: number) => {
    setStart(value);
    // Preserve existing booking duration when shifting start time, capped by maximum allowable minutes.
    setEnd(Math.min(value + Math.max(end - start, STEP_MINUTES), value + MAX_MINUTES, MINUTES_PER_DAY));
  };

  const toggle = (id: string) =>
    setInvited((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/workspace/bookings', {
        method: 'POST',
        body: {
          roomId,
          title,
          startsAt: atMinutes(day, start).toISOString(),
          endsAt: atMinutes(day, end).toISOString(),
          attendeeIds: [...invited],
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      onBooked();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not book the room. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-4">
      <TextField
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={MAX_TITLE_LENGTH_CHARS}
        required
        autoFocus
        placeholder="Sprint planning"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select label="Room" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select label="Starts" value={start} onChange={(e) => changeStart(Number(e.target.value))}>
          {STEPS.slice(0, -1).map((m) => (
            <option key={m} value={m}>
              {clockOf(m)}
            </option>
          ))}
        </Select>
        <Select label="Ends" value={end} onChange={(e) => setEnd(Number(e.target.value))}>
          {STEPS.filter((m) => m > start && m <= start + MAX_MINUTES).map((m) => (
            <option key={m} value={m}>
              {clockOf(m)}
            </option>
          ))}
        </Select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-zinc-800">
          People <span className="font-normal text-zinc-500">· only they can enter during the meeting</span>
        </legend>
        {members.length > MEMBER_FILTER_THRESHOLD_COUNT && (
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Find someone"
            aria-label="Find someone"
            className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
          />
        )}
        <div className="grid max-h-40 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
          <Checkbox label="You" checked disabled />
          {others.map((m) => (
            <Checkbox key={m.userId} label={m.displayName} checked={invited.has(m.userId)} onChange={() => toggle(m.userId)} />
          ))}
        </div>
      </fieldset>

      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" loading={busy}>
          Book {rooms.find((r) => r.id === roomId)?.name}
        </Button>
      </div>
    </form>
  );
}
