/**
 * Proximity and permission rules governing voice chat between office members.
 * Evaluated by VoiceGateway to authorize WebRTC signalling.
 */

import { TILE } from '../office/layout/geometry';
import type { Room } from '../office/layout/types';

/** The client hears at 3 tiles; the server uses 4 to tolerate movement latency. */
const SERVER_EARSHOT_TILES = 4;

/** Maximum distance in pixels at which two people outside meeting rooms can hear each other. */
export const EARSHOT_PX = SERVER_EARSHOT_TILES * TILE;

/** Coordinates and room location for a user from office gateway positioning. */
export interface Spot {
  x: number;
  y: number;
  room: Room | null;
}

/** Determines whether two user positions are close enough and unpartitioned to exchange audio. */
export function withinEarshot(a: Spot | null, b: Spot | null): boolean {
  if (!a || !b) return false;
  // Physical walls block audio: users must reside in the exact same room or both in open space.
  if ((a.room?.id ?? null) !== (b.room?.id ?? null)) return false;
  // Spatial attenuation is disabled in meeting rooms so all participants hear each other clearly.
  if (a.room?.kind === 'meeting') return true;
  // Open floor audio decays with distance; 4-tile threshold tolerates position sync lag.
  return Math.hypot(a.x - b.x, a.y - b.y) <= EARSHOT_PX;
}

/** Checks whether a meeting room's active booking allows two members to converse. */
export function bookingAllows(booking: { attendeeIds: string[] } | null, a: string, b: string): boolean {
  // Free rooms allow open conversation; booked rooms preserve confidentiality for invitees only.
  return !booking || (booking.attendeeIds.includes(a) && booking.attendeeIds.includes(b));
}

