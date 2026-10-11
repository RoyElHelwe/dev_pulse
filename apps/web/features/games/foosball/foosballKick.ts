/**
 * Pure gesture detection and kick strength calculations for Foosball mouse controls.
 * Detects rapid flick motions and mouse clicks to produce kick actions with proportional power.
 */

import { FIELD_W, SCALE } from './constants';
import { clamp } from './foosballPointer';

/** Height of the playing field in logical canvas pixels (64 units * 4 = 256 px). */
export const PITCH_H_PX = FIELD_W * SCALE;

/** Minimum cooldown interval between consecutive kicks in milliseconds (0.35 s). */
export const KICK_COOLDOWN_MS = 350;

/** Time window in milliseconds for retaining pointer movement samples (55 ms). */
export const FLICK_SAMPLE_WINDOW_MS = 55;

/** Minimum time span in seconds required across movement samples to evaluate velocity (15 ms). */
export const MIN_FLICK_DT_S = 0.015;

/** Speed threshold in table-heights per second to trigger an automatic flick kick. */
export const FLICK_VELOCITY_THRESHOLD = 3.5;

/** Minimum base strength imparted by a flick gesture kick. */
export const KICK_BASE_STRENGTH = 0.35;

/** Scaling factor for converting excess velocity into kick strength. */
export const KICK_VELOCITY_SCALE = 6;

/** Minimum kick strength imparted on an intentional mouse click. */
export const CLICK_MIN_KICK_STRENGTH = 0.6;

/** Movement sample containing logical Y position and high-resolution timestamp. */
export interface PointerSample {
  time: number;
  y: number;
}

/** Result of checking movement samples for a flick gesture. */
export interface FlickKickResult {
  kicked: boolean;
  strength: number;
}

/**
 * Removes samples older than maxAgeMs relative to current timestamp.
 * Mutates the array in-place to avoid allocations during frequent pointer movement.
 */
export function pruneOldSamples(
  samples: PointerSample[],
  nowMs: number,
  maxAgeMs = FLICK_SAMPLE_WINDOW_MS,
): void {
  while (samples.length > 1 && samples[0] && nowMs - samples[0].time > maxAgeMs) {
    samples.shift();
  }
}

/**
 * Computes vertical velocity in table-heights per second from movement samples.
 * Returns 0 if fewer than 2 samples exist or elapsed time is below the minimum threshold.
 */
export function calculateVerticalVelocity(samples: readonly PointerSample[]): number {
  if (samples.length < 2) return 0;
  const oldest = samples[0];
  const newest = samples[samples.length - 1];
  if (!oldest || !newest) return 0;

  const dtSec = (newest.time - oldest.time) / 1000;
  if (dtSec < MIN_FLICK_DT_S) return 0;

  const dy = Math.abs(newest.y - oldest.y);
  return dy / PITCH_H_PX / dtSec;
}

/**
 * Converts vertical velocity (table-heights/s) into kick strength in range [0.35, 1.0].
 */
export function velocityToKickStrength(velocity: number): number {
  return clamp(
    KICK_BASE_STRENGTH + (velocity - FLICK_VELOCITY_THRESHOLD) / KICK_VELOCITY_SCALE,
    KICK_BASE_STRENGTH,
    1,
  );
}

/**
 * Checks if recent pointer movement qualifies as a flick kick gesture.
 */
export function detectFlickKick(
  samples: readonly PointerSample[],
  nowMs: number,
  lastKickTimeMs: number,
): FlickKickResult {
  if (nowMs - lastKickTimeMs < KICK_COOLDOWN_MS) {
    return { kicked: false, strength: 0 };
  }

  const velocity = calculateVerticalVelocity(samples);
  if (velocity >= FLICK_VELOCITY_THRESHOLD) {
    return {
      kicked: true,
      strength: velocityToKickStrength(velocity),
    };
  }

  return { kicked: false, strength: 0 };
}

/**
 * Calculates kick strength for a click event, combining minimum click power with current cursor speed.
 * Returns null if the kick cooldown has not elapsed yet.
 */
export function calculateClickKickStrength(
  samples: readonly PointerSample[],
  nowMs: number,
  lastKickTimeMs: number,
): number | null {
  if (nowMs - lastKickTimeMs < KICK_COOLDOWN_MS) {
    return null;
  }

  const velocity = calculateVerticalVelocity(samples);
  const speedStrength = velocity >= FLICK_VELOCITY_THRESHOLD ? velocityToKickStrength(velocity) : 0;
  return Math.max(CLICK_MIN_KICK_STRENGTH, speedStrength);
}
