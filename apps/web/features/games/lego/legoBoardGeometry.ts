/**
 * Coordinate transformations, color conversion, and shape geometry helpers for Lego boards.
 * Provides pure mathematical utilities for canvas sizing and pointer hit testing.
 */

/**
 * Calculates responsive cell size in pixels that fits within the available container.
 */
export function computeSquareCellSize(
  containerWidth: number,
  containerHeight: number,
  boardWidthStuds: number,
  boardHeightStuds: number,
  minCellSizePx: number,
): number {
  if (containerWidth <= 0 || containerHeight <= 0) return minCellSizePx;
  const computed = Math.floor(Math.min(containerWidth / boardWidthStuds, containerHeight / boardHeightStuds));
  return Math.max(minCellSizePx, computed);
}

/**
 * Converts mouse/pointer event coordinates relative to the canvas into integer stud coordinates.
 */
export function getStudCoordsFromPointer(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  boardWidthStuds: number,
  boardHeightStuds: number,
): [number, number] | null {
  const rawX = Math.floor(((clientX - canvasRect.left) / canvasRect.width) * boardWidthStuds);
  const rawY = Math.floor(((clientY - canvasRect.top) / canvasRect.height) * boardHeightStuds);
  if (rawX < 0 || rawX >= boardWidthStuds || rawY < 0 || rawY >= boardHeightStuds) {
    return null;
  }
  return [rawX, rawY];
}

/**
 * Converts a hex color string (e.g. '#ef4444') to an rgba CSS color with specified alpha.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Returns the effective [width, height] dimensions of a brick factoring in 90-degree rotation.
 */
export function getEffectiveShape(
  baseShape: readonly [number, number],
  rotated: boolean,
): [number, number] {
  const [bw, bh] = baseShape;
  return rotated ? [bh, bw] : [bw, bh];
}
