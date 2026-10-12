// Colour helpers shared by features: layouts and the editor store colours as 0xRRGGBB numbers.

/** 0xRRGGBB number -> "#rrggbb" CSS colour; undefined stays undefined. */
export function hexColor(color: number): string;
/** Overload preserving undefined input when formatting numeric colours to CSS strings. */
export function hexColor(color: number | undefined): string | undefined;
/** Converts a numeric 0xRRGGBB colour into a six-digit hexadecimal CSS string or undefined. */
export function hexColor(color: number | undefined): string | undefined {
  return color === undefined ? undefined : `#${color.toString(16).padStart(6, '0')}`;
}
