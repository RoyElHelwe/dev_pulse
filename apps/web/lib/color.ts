// Colour helpers shared by features: layouts and the editor store colours as 0xRRGGBB numbers.

/** 0xRRGGBB number -> "#rrggbb" CSS colour; undefined stays undefined. */
export function hexColor(color: number): string;
export function hexColor(color: number | undefined): string | undefined;
export function hexColor(color: number | undefined): string | undefined {
  return color === undefined ? undefined : `#${color.toString(16).padStart(6, '0')}`;
}
