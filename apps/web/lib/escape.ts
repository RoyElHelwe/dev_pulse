'use client';

import { useEffect, useRef } from 'react';

// One Escape key for the whole app: every open menu, panel or dialog registers a
// layer while it is open, and Escape closes only the top-most (latest opened) one.
// With nothing open the key is left alone (the game, the editor...).

interface Layer {
  handler(): void;
}

const stack: Layer[] = [];
let installed = false;

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.isComposing || e.defaultPrevented) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  top.handler();
}

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  // Capture phase: runs before the game's and the inputs' own key handlers.
  window.addEventListener('keydown', onKeyDown, true);
}

/** True while something registered with `useEscape` is open. */
export function hasEscapeLayer() {
  return stack.length > 0;
}

/**
 * While `active`, Escape calls `onEscape` if this is the top-most open layer.
 * Layers stack in the order they became active, so a dialog opened from a panel
 * closes first. `onEscape` should close the thing (and may blur/refocus).
 */
export function useEscape(active: boolean, onEscape: () => void) {
  const ref = useRef(onEscape);
  ref.current = onEscape;
  useEffect(() => {
    if (!active) return;
    install();
    const layer: Layer = { handler: () => ref.current() };
    stack.push(layer);
    return () => {
      const i = stack.indexOf(layer);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}
