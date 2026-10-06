// Spatial voice maths: how loud someone is, and where the sound comes from. Pure functions
// (tiles in, 0..1 gain out); VoiceManager feeds them into one GainNode + PannerNode per call.

export type Facing = 'up' | 'down' | 'left' | 'right';

/** Open space: full volume within this distance (tiles). */
export const CLOSE = 1;
/** Meeting room: the far wall (the room's longer side) still sounds like this. */
export const MEETING_FLOOR = 0.3;
/** Meeting room: inside this distance (tiles) everyone is at full volume. */
const MEETING_CLOSE = 1.5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Open space: full volume within `CLOSE`, then a smooth (cosine) fall to silence at `edge`
 * (the distance where the call is dropped).
 */
export function openGain(distance: number, edge: number): number {
  const t = clamp01((distance - CLOSE) / (edge - CLOSE));
  return 0.5 * (1 + Math.cos(Math.PI * t));
}

/**
 * Meeting room: everyone is heard, but clearly quieter the farther they are. Falls from 1
 * (within a tile and a half) to `MEETING_FLOOR` at `span` tiles (the room's longer side, so
 * both people hear each other the same, wherever they stand).
 */
export function meetingGain(distance: number, span: number): number {
  const t = clamp01((distance - MEETING_CLOSE) / Math.max(1, span - MEETING_CLOSE));
  return MEETING_FLOOR + (1 - MEETING_FLOOR) * Math.pow(1 - t, 1.5);
}

/**
 * Turns the screen-space offset to a speaker into the listener's frame, where the Web Audio
 * default listener looks "up the screen" (forward = -z, right = +x). Someone facing `dir`
 * (or sitting at a chair that faces `dir`) hears what is in front of them in front.
 */
export function relativeTo(dx: number, dy: number, dir: Facing): { x: number; z: number } {
  switch (dir) {
    case 'right':
      return { x: dy, z: -dx };
    case 'left':
      return { x: -dy, z: dx };
    case 'down':
      return { x: -dx, z: -dy };
    default:
      return { x: dx, z: dy };
  }
}
