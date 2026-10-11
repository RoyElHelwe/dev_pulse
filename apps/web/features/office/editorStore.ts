/**
 * React state subscription hook for the office LayoutEditor instance.
 * Re-renders subscribers whenever editor tools, dirty flags, or selections change.
 */

'use client';

import { useSyncExternalStore } from 'react';
import type { LayoutEditor } from '@/game/editor/LayoutEditor';

/** Subscribes to live layout editor state changes. */
export function useEditorState(editor: LayoutEditor) {
  return useSyncExternalStore(editor.subscribe, editor.getState, editor.getState);
}
