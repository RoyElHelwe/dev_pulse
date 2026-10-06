/**
 * Focus is in a text field, or inside a panel that captures the keyboard
 * (`data-captures-keys`, e.g. the task board): keys are not game shortcuts.
 */
export function isTyping() {
  const el = document.activeElement;
  if (el instanceof HTMLElement && el.closest('[data-captures-keys]')) return true;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);
}
