// Utility helper for composing conditional Tailwind CSS class names.

/** Joins class names, skipping empty values. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}
