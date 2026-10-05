import { describe, expect, it } from 'vitest';
import { clock, findClash, overlaps, slotProblem, slotStart } from './booking-rules';

const at = (iso: string) => new Date(iso);
const now = at('2026-10-05T10:07:00Z');

describe('slotProblem', () => {
  it('accepts a quarter-hour slot later today', () => {
    expect(slotProblem(at('2026-10-05T14:00:00Z'), at('2026-10-05T15:30:00Z'), now)).toBeNull();
  });

  it('accepts the slot running right now', () => {
    expect(slotStart(now).toISOString()).toBe('2026-10-05T10:00:00.000Z');
    expect(slotProblem(at('2026-10-05T10:00:00Z'), at('2026-10-05T10:30:00Z'), now)).toBeNull();
  });

  it('refuses times off the 15-minute grid', () => {
    expect(slotProblem(at('2026-10-05T14:10:00Z'), at('2026-10-05T15:00:00Z'), now)).toMatch(/15-minute/);
    expect(slotProblem(at('2026-10-05T14:00:00Z'), at('2026-10-05T15:00:30Z'), now)).toMatch(/15-minute/);
  });

  it('refuses an end before the start, and empty meetings', () => {
    expect(slotProblem(at('2026-10-05T15:00:00Z'), at('2026-10-05T14:00:00Z'), now)).toMatch(/end after/);
    expect(slotProblem(at('2026-10-05T15:00:00Z'), at('2026-10-05T15:00:00Z'), now)).toMatch(/end after/);
  });

  it('refuses more than 4 hours', () => {
    expect(slotProblem(at('2026-10-05T12:00:00Z'), at('2026-10-05T16:00:00Z'), now)).toBeNull();
    expect(slotProblem(at('2026-10-05T12:00:00Z'), at('2026-10-05T16:15:00Z'), now)).toMatch(/4 hours/);
  });

  it('refuses the past and more than 30 days ahead', () => {
    expect(slotProblem(at('2026-10-05T09:45:00Z'), at('2026-10-05T10:30:00Z'), now)).toMatch(/past/);
    expect(slotProblem(at('2026-11-10T10:00:00Z'), at('2026-11-10T11:00:00Z'), now)).toMatch(/30 days/);
  });

  it('refuses invalid dates', () => {
    expect(slotProblem(new Date('nope'), at('2026-10-05T11:00:00Z'), now)).toMatch(/start and an end/);
  });
});

describe('overlap', () => {
  const booked = [{ id: 'a', startsAt: at('2026-10-05T14:00:00Z'), endsAt: at('2026-10-05T15:00:00Z') }];

  it('finds a clash', () => {
    expect(findClash({ startsAt: at('2026-10-05T14:30:00Z'), endsAt: at('2026-10-05T15:30:00Z') }, booked)?.id).toBe('a');
    expect(findClash({ startsAt: at('2026-10-05T13:00:00Z'), endsAt: at('2026-10-05T16:00:00Z') }, booked)?.id).toBe('a');
  });

  it('lets meetings follow each other', () => {
    expect(overlaps({ startsAt: at('2026-10-05T15:00:00Z'), endsAt: at('2026-10-05T16:00:00Z') }, booked[0])).toBe(false);
    expect(overlaps({ startsAt: at('2026-10-05T13:00:00Z'), endsAt: at('2026-10-05T14:00:00Z') }, booked[0])).toBe(false);
  });
});

describe('clock', () => {
  it('formats in the asked time zone, UTC otherwise', () => {
    expect(clock(at('2026-10-05T14:00:00Z'), 'Europe/Paris')).toBe('16:00');
    expect(clock(at('2026-10-05T14:00:00Z'), 'Not/AZone')).toBe('14:00');
    expect(clock(at('2026-10-05T14:00:00Z'))).toBe('14:00');
  });
});
