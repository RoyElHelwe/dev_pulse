/**
 * Pure coordinate mapping and rod-aiming geometry for Foosball mouse controls.
 * Translates client/screen pointer positions into canvas pixels and physical pitch offsets.
 */

import {
  CANVAS_H,
  CANVAS_W,
  FIELD_W,
  OFFSET_X,
  OFFSET_Y,
  ROD_TRAVEL_LIMITS,
  ROD_X_A,
  ROD_X_B,
  SCALE,
  type FoosballSide,
} from './constants';

/** Maximum horizontal distance (units) between click and rod to trigger selection. */
export const DEFAULT_ROD_SELECTION_TOLERANCE_UNITS = 6;

/** Record tracking the last sent aim offset and its performance timestamp. */
export interface AimRecord {
  rod: number;
  y: number;
  time: number;
}

/** Clamps a number between a lower and an upper bound. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Maps logical canvas X (px) to physical field coordinate (units). */
export function canvasToFieldX(cursorXPx: number): number {
  return (cursorXPx - OFFSET_X) / SCALE;
}

/** Maps logical canvas Y (px) to physical field coordinate (units). */
export function canvasToFieldY(cursorYPx: number): number {
  return (cursorYPx - OFFSET_Y) / SCALE;
}

/**
 * Computes the target travel offset for a rod from cursor Y position.
 * Normalized from [-1, 1] relative to pitch centerline and scaled by rod limit.
 */
export function computeTargetOffset(cursorYPx: number, rodIndex: number): number {
  const fieldY = canvasToFieldY(cursorYPx);
  const halfFieldW = FIELD_W / 2;
  const normalized = clamp((fieldY - halfFieldW) / halfFieldW, -1, 1);
  const limit = ROD_TRAVEL_LIMITS[rodIndex] ?? 0;
  return normalized * limit;
}

/** Converts screen client coordinates to logical canvas pixels based on client bounding rect. */
export function clientToLogicalPos(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  const cx = ((clientX - rect.left) / rect.width) * CANVAS_W;
  const cy = ((clientY - rect.top) / rect.height) * CANVAS_H;
  return {
    x: clamp(cx, 0, CANVAS_W),
    y: clamp(cy, 0, CANVAS_H),
  };
}

/** Integrates pointer lock mouse deltas into logical canvas coordinates. */
export function integrateLockedMovement(
  currPos: { x: number; y: number },
  movement: { movementX?: number; movementY?: number },
  rect: { width: number; height: number },
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { ...currPos };
  const scaleX = CANVAS_W / rect.width;
  const scaleY = CANVAS_H / rect.height;
  return {
    x: clamp(currPos.x + (movement.movementX ?? 0) * scaleX, 0, CANVAS_W),
    y: clamp(currPos.y + (movement.movementY ?? 0) * scaleY, 0, CANVAS_H),
  };
}

/**
 * Finds the closest owned rod to a given field X position within selection tolerance.
 * Returns -1 if no owned rod is close enough.
 */
export function findClosestOwnedRod(
  fieldX: number,
  ownedRods: readonly number[],
  side: FoosballSide,
  toleranceUnits = DEFAULT_ROD_SELECTION_TOLERANCE_UNITS,
): number {
  const rodXList = side === 'A' ? ROD_X_A : ROD_X_B;
  let closestRod = -1;
  let closestDist = Infinity;

  for (const rod of ownedRods) {
    const rx = rodXList[rod];
    if (rx === undefined) continue;
    const dist = Math.abs(fieldX - rx);
    if (dist <= toleranceUnits && dist < closestDist) {
      closestDist = dist;
      closestRod = rod;
    }
  }

  return closestRod;
}

/**
 * Evaluates whether an aim update should be dispatched immediately or delayed based on throttle and delta limits.
 */
export function shouldSendImmediateAim(
  lastSent: AimRecord | null,
  rod: number,
  targetY: number,
  nowMs: number,
  thresholdUnits: number,
  throttleMs: number,
): { sendNow: boolean; exceedsThreshold: boolean } {
  if (!lastSent || lastSent.rod !== rod) return { sendNow: true, exceedsThreshold: true };
  const exceedsThreshold = Math.abs(targetY - lastSent.y) > thresholdUnits;
  const sendNow = exceedsThreshold && nowMs - lastSent.time >= throttleMs;
  return { sendNow, exceedsThreshold };
}

/** Safely attempts to request pointer lock on a canvas element. */
export function safeRequestPointerLock(canvas: HTMLCanvasElement | null): void {
  if (!canvas || typeof document === 'undefined' || document.pointerLockElement === canvas) return;
  try {
    const p = canvas.requestPointerLock?.();
    if (p && typeof (p as Promise<void>).catch === 'function') {
      (p as Promise<void>).catch(() => {});
    }
  } catch {}
}

/** Safely exits pointer lock if currently locked to the specified canvas or generally. */
export function safeExitPointerLock(canvas?: HTMLCanvasElement | null): void {
  if (typeof document === 'undefined') return;
  if (!canvas || document.pointerLockElement === canvas) {
    try {
      document.exitPointerLock?.();
    } catch {}
  }
}
