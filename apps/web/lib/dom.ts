/** Focus is in a text field: keys are typing, not shortcuts. */
export function isTyping() {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);
}
