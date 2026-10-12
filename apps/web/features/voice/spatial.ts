// Spatial audio math: distance-based gain curves and listener-relative direction vectors.
// Pure calculation helpers consumed by VoiceAudio to configure Web Audio nodes.

/** Cardinal facing direction of the player avatar used to rotate spatial audio into listener-relative space. */
export type Facing = 'up' | 'down' | 'left' | 'right';

const CLOSE_RADIUS_TILES = 1;
const MEETING_VOLUME_FLOOR = 0.3;
const MEETING_CLOSE_RADIUS_TILES = 1.5;
const MEETING_DISTANCE_EXPONENT = 1.5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Calculates distance attenuation gain using a cosine falloff curve falling to zero at edge radius. */
export function openGain(distance: number, edge: number): number {
  // Use a cosine curve between full volume and drop edge to guarantee a smooth transition without audio clipping.
  const t = clamp01((distance - CLOSE_RADIUS_TILES) / (edge - CLOSE_RADIUS_TILES));
  return 0.5 * (1 + Math.cos(Math.PI * t));
}

/** Calculates distance attenuation gain for meeting rooms with a minimum floor at far-wall distance. */
export function meetingGain(distance: number, span: number): number {
  // Everyone in a meeting room remains audible, but volume drops gently toward far-wall distance for natural presence.
  const t = clamp01((distance - MEETING_CLOSE_RADIUS_TILES) / Math.max(1, span - MEETING_CLOSE_RADIUS_TILES));
  return MEETING_VOLUME_FLOOR + (1 - MEETING_VOLUME_FLOOR) * Math.pow(1 - t, MEETING_DISTANCE_EXPONENT);
}

/** Rotates screen-space coordinate offsets into the avatar's facing orientation frame. */
export function relativeTo(dx: number, dy: number, dir: Facing): { x: number; z: number } {
  // In the Web Audio listener reference frame, forward is -Z and right is +X.
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
