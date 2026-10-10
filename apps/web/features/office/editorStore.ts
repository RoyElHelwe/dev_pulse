'use client';

// React binding for the layout editor's state. The editor (game/editor/LayoutEditor) is a plain
// class that owns the draft layout and notifies subscribers; this hook re-renders on each change.

import { useSyncExternalStore } from 'react';
import type { LayoutEditor } from '@/game/editor/LayoutEditor';

/** The editor's current state (selection, tool, dirty flag...), live. */
export function useEditorState(editor: LayoutEditor) {
  return useSyncExternalStore(editor.subscribe, editor.getState, editor.getState);
}
