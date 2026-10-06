import { describe, expect, it } from 'vitest';
import type { Room } from '../office/layout/types';
import { bookingAllows, EARSHOT_PX, withinEarshot } from './talk-rule';

const room = (id: string, kind: Room['kind']): Room => ({ id, name: id, kind, x: 0, y: 0, w: 10, h: 10, floor: 'oak' });
const meeting = room('atlas', 'meeting');
const lounge = room('lounge', 'lounge');
const chill = room('chill', 'chill');

describe('withinEarshot', () => {
  it('lets people close to each other in the open space talk', () => {
    expect(withinEarshot({ x: 0, y: 0, room: null }, { x: 96, y: 0, room: null })).toBe(true);
    expect(withinEarshot({ x: 0, y: 0, room: lounge }, { x: 0, y: EARSHOT_PX, room: lounge })).toBe(true);
    expect(withinEarshot({ x: 0, y: 0, room: chill }, { x: 0, y: EARSHOT_PX, room: chill })).toBe(true);
  });

  it('refuses people too far apart outside meeting rooms', () => {
    expect(withinEarshot({ x: 0, y: 0, room: null }, { x: EARSHOT_PX + 1, y: 0, room: null })).toBe(false);
    expect(withinEarshot({ x: 0, y: 0, room: lounge }, { x: 200, y: 200, room: lounge })).toBe(false);
    expect(withinEarshot({ x: 0, y: 0, room: chill }, { x: 200, y: 200, room: chill })).toBe(false);
  });

  it('lets everyone in a meeting room talk, whatever the distance', () => {
    expect(withinEarshot({ x: 0, y: 0, room: meeting }, { x: 300, y: 300, room: meeting })).toBe(true);
  });

  it('keeps walls between people: different rooms never talk, even side by side', () => {
    expect(withinEarshot({ x: 0, y: 0, room: meeting }, { x: 10, y: 0, room: null })).toBe(false);
    expect(withinEarshot({ x: 0, y: 0, room: null }, { x: 10, y: 0, room: meeting })).toBe(false);
    expect(withinEarshot({ x: 0, y: 0, room: lounge }, { x: 10, y: 0, room: meeting })).toBe(false);
  });

  it('refuses someone who is not in the office', () => {
    expect(withinEarshot(null, { x: 0, y: 0, room: null })).toBe(false);
    expect(withinEarshot({ x: 0, y: 0, room: null }, null)).toBe(false);
  });
});

describe('bookingAllows', () => {
  it('allows anyone when the room is free', () => {
    expect(bookingAllows(null, 'a', 'b')).toBe(true);
  });

  it('allows only attendees of a running meeting', () => {
    const booking = { attendeeIds: ['a', 'b'] };
    expect(bookingAllows(booking, 'a', 'b')).toBe(true);
    expect(bookingAllows(booking, 'a', 'c')).toBe(false);
    expect(bookingAllows(booking, 'c', 'b')).toBe(false);
  });
});
