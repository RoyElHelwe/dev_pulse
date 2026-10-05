import { TILE } from '../office/layout/geometry';
import type { Room } from '../office/layout/types';

/** People hear each other within 3 tiles; the server allows 4 (positions arrive a little late). */
export const EARSHOT_PX = 4 * TILE;

/** Where someone stands, as OfficeGateway.locate() reports it (pixels, server geometry). */
export interface Spot {
  x: number;
  y: number;
  room: Room | null;
}

/**
 * May these two talk, from where they stand? Walls separate people: they must be
 * in the same room (or both outside every room). In a meeting room everyone hears
 * everyone; elsewhere only within earshot.
 */
export function withinEarshot(a: Spot | null, b: Spot | null): boolean {
  if (!a || !b) return false;
  if ((a.room?.id ?? null) !== (b.room?.id ?? null)) return false;
  if (a.room?.kind === 'meeting') return true;
  return Math.hypot(a.x - b.x, a.y - b.y) <= EARSHOT_PX;
}

/** While a meeting room is booked, only its attendees talk in it. */
export function bookingAllows(booking: { attendeeIds: string[] } | null, a: string, b: string): boolean {
  return !booking || (booking.attendeeIds.includes(a) && booking.attendeeIds.includes(b));
}
