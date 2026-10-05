import { describe, expect, it } from 'vitest';
import { channelAccess, cleanText, isChannel, MAX_LENGTH, RateLimiter } from './chat.rules';

describe('cleanText', () => {
  it('trims and accepts 1 to 500 characters', () => {
    expect(cleanText('  hello \n')).toBe('hello');
    expect(cleanText('x'.repeat(MAX_LENGTH))).toHaveLength(MAX_LENGTH);
  });

  it('refuses empty, too long or non-text messages', () => {
    expect(cleanText('   ')).toBeNull();
    expect(cleanText('x'.repeat(MAX_LENGTH + 1))).toBeNull();
    expect(cleanText(42)).toBeNull();
    expect(cleanText(undefined)).toBeNull();
  });
});

describe('isChannel', () => {
  it('accepts the office and room ids only', () => {
    expect(isChannel('office')).toBe(true);
    expect(isChannel('room-atlas')).toBe(true);
    expect(isChannel('')).toBe(false);
    expect(isChannel('a b')).toBe(false);
    expect(isChannel({})).toBe(false);
  });
});

describe('channelAccess', () => {
  const atlas = { id: 'atlas', kind: 'meeting' };

  it('opens the office channel to everyone', () => {
    expect(channelAccess('office', 'u1', null, null)).toBeNull();
  });

  it('opens a room channel only to the people in that room', () => {
    expect(channelAccess('atlas', 'u1', atlas, null)).toBeNull();
    expect(channelAccess('atlas', 'u1', { id: 'other', kind: 'meeting' }, null)).toBe('NOT_IN_ROOM');
    expect(channelAccess('atlas', 'u1', null, null)).toBe('NOT_IN_ROOM');
    expect(channelAccess('open', 'u1', { id: 'open', kind: 'open' }, null)).toBe('NOT_IN_ROOM');
  });

  it('keeps a booked room to its attendees', () => {
    expect(channelAccess('atlas', 'u1', atlas, { attendeeIds: ['u1'] })).toBeNull();
    expect(channelAccess('atlas', 'u2', atlas, { attendeeIds: ['u1'] })).toBe('NOT_ATTENDEE');
  });
});

describe('RateLimiter', () => {
  it('allows 5 messages in 5 seconds, then again once the window slides', () => {
    const limiter = new RateLimiter(5, 5000);
    for (let i = 0; i < 5; i++) expect(limiter.allow('u1', 1000 + i)).toBe(true);
    expect(limiter.allow('u1', 2000)).toBe(false);
    expect(limiter.allow('u2', 2000)).toBe(true);
    expect(limiter.allow('u1', 6001)).toBe(true);
  });
});
