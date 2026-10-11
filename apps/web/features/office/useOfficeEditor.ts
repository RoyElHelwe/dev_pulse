/**
 * Layout editor state and mutation actions for office organisers.
 * Coordinates LayoutEditor session, validation, persistence, and discard confirmation.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MyWorkspace } from '@/features/workspace/types';
import type { OfficeController } from '@/game/createGame';
import { LayoutEditor } from '@/game/editor/LayoutEditor';
import type { OfficeLayout } from '@/game/layout/types';
import { api, ApiError } from '@/lib/api';

/** Active office layout modification session encapsulating the editor instance and optimistic lock version. */
export interface Editing {
  editor: LayoutEditor;
  /** The layout version the edit started from: saving fails if someone saved since. */
  baseVersion: number;
}

interface UseOfficeEditorOptions {
  workspace: MyWorkspace | null;
  setWorkspace: React.Dispatch<React.SetStateAction<MyWorkspace | null>>;
  controller: OfficeController | null;
  setToast: (message: string) => void;
  versionRef: React.MutableRefObject<number>;
}

/** Manages layout editor state, persistence, and unload warnings for organisers. */
export function useOfficeEditor({
  workspace,
  setWorkspace,
  controller,
  setToast,
  versionRef,
}: UseOfficeEditorOptions) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<{ message: string; reload: boolean } | null>(null);
  const editingRef = useRef<Editing | null>(null);
  editingRef.current = editing;

  const startEditing = useCallback(() => {
    if (!controller || !workspace || editingRef.current) return;
    const editor = new LayoutEditor(workspace.layout);
    controller.startEditing(editor, setToast);
    setEditError(null);
    setEditing({ editor, baseVersion: workspace.layoutVersion });
  }, [controller, workspace, setToast]);

  const stopEditing = useCallback(
    (layout: OfficeLayout) => {
      controller?.setLayout(layout);
      setEditing(null);
      setEditError(null);
    },
    [controller],
  );

  const discard = useCallback(() => {
    if (!workspace || !editing) return;
    if (editing.editor.getState().dirty && !window.confirm('Discard your changes to the office?')) return;
    stopEditing(workspace.layout);
  }, [workspace, editing, stopEditing]);

  const save = useCallback(async () => {
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    try {
      const saved = await api<{ layout: OfficeLayout; version: number }>('/workspace/layout', {
        method: 'PUT',
        body: editing.editor.toSave(editing.baseVersion),
      });
      versionRef.current = Math.max(versionRef.current, saved.version);
      setWorkspace((w) => (w ? { ...w, layout: saved.layout, layoutVersion: saved.version } : w));
      stopEditing(saved.layout);
      setToast('Saved. Everyone in the office sees the new layout.');
    } catch (err) {
      const e = err instanceof ApiError ? err : null;
      if (e?.code === 'LAYOUT_INVALID' && Array.isArray(e.details)) {
        const ids = (e.details as { itemIds?: string[] }[]).flatMap((p) => p.itemIds ?? []);
        editing.editor.flag(ids);
      }
      setEditError({
        message: e?.message ?? 'Could not save the office. Please try again.',
        reload: e?.code === 'LAYOUT_CHANGED',
      });
    } finally {
      setSaving(false);
    }
  }, [editing, stopEditing, versionRef, setWorkspace, setToast]);

  const resetToTemplate = useCallback(async () => {
    if (!editing) return;
    if (!window.confirm('Put back the original furniture and room names? You can still undo, or close without saving.')) return;
    const latest = await api<MyWorkspace>('/workspace').catch(() => null);
    // A generated office is built again from the same team size and seed.
    const source = latest?.layout.generated;
    const query = source ? `?team=${source.teamSize}&seed=${encodeURIComponent(source.seed)}` : '';
    const templates = await api<{ id: string; layout: OfficeLayout }[]>(`/office/templates${query}`).catch(() => []);
    const template = templates.find((t) => t.id === latest?.templateId);
    if (template) editing.editor.reset(template.layout);
  }, [editing]);

  const reloadLatest = useCallback(async () => {
    const latest = await api<MyWorkspace>('/workspace').catch(() => null);
    if (!latest) return;
    versionRef.current = Math.max(versionRef.current, latest.layoutVersion);
    setWorkspace(latest);
    stopEditing(latest.layout);
  }, [stopEditing, versionRef, setWorkspace]);

  // Unsaved changes: ask before leaving the page.
  useEffect(() => {
    if (!editing) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (editing.editor.getState().dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing]);

  return {
    editing,
    saving,
    editError,
    startEditing,
    stopEditing,
    discard,
    save,
    resetToTemplate,
    reloadLatest,
  };
}
