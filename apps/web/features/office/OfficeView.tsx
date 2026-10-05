'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import type { MyWorkspace } from '@/features/workspace/types';
import type { OfficeController } from '@/game/createGame';
import { LayoutEditor } from '@/game/editor/LayoutEditor';
import type { OfficeLayout } from '@/game/layout/types';
import { api, ApiError } from '@/lib/api';
import { connectOffice, type Presence } from './connection';
import { EditorPanel } from './EditorPanel';
import { officeEvents } from './events';
import { OfficeHud } from './OfficeHud';

interface Editing {
  editor: LayoutEditor;
  /** The layout version the edit started from: saving fails if someone saved since. */
  baseVersion: number;
}

/** Full-screen office: the Phaser canvas, the live connection and the HUD. */
export function OfficeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<OfficeController | null>(null);
  const [ready, setReady] = useState(false);
  const [workspace, setWorkspace] = useState<MyWorkspace | null>(null);
  const [people, setPeople] = useState<Presence[]>([]);
  const [toast, setToast] = useState('');
  const [online, setOnline] = useState(true);
  const { status, user, reloadUser } = useAuth();
  const router = useRouter();
  // Set while leaving with a message, so the plain "no office" redirect doesn't win.
  const leaving = useRef(false);

  // Office editor (organisers).
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<{ message: string; reload: boolean } | null>(null);
  const editingRef = useRef<Editing | null>(null);
  editingRef.current = editing;
  // Latest layout we know of, so our own save's echo (or an old event) is ignored.
  const versionRef = useRef(0);
  versionRef.current = Math.max(versionRef.current, workspace?.layoutVersion ?? 0);

  const leave = useCallback(
    async (notice: string) => {
      leaving.current = true;
      await reloadUser();
      router.replace(`/onboarding?notice=${notice}`);
    },
    [reloadUser, router],
  );

  // Signed out → sign in; no office yet → onboarding; otherwise load it.
  useEffect(() => {
    if (status === 'signed-out') router.replace('/login?redirect=/office');
    if (status !== 'signed-in' || !user || leaving.current) return;
    if (!user.workspace) return void router.replace('/onboarding');
    api<MyWorkspace>('/workspace').then(setWorkspace, () => void leave('no_workspace'));
  }, [status, user, router, leave]);

  const workspaceId = workspace?.id;
  const myId = user?.id;
  const name = user?.displayName;

  useEffect(() => {
    if (!workspace || !myId || !name) return;
    let cancelled = false;
    let game: OfficeController | null = null;

    const connection = connectOffice(() => controllerRef.current, {
      myId,
      onPresence: setPeople,
      onLayout(layout: OfficeLayout, version: number, by: string) {
        if (version <= versionRef.current) return;
        if (editingRef.current && by === myId) return; // our save; its response applies it
        versionRef.current = version;
        setWorkspace((w) => (w ? { ...w, layout, layoutVersion: version } : w));
        if (editingRef.current) {
          // Keep the organiser's edit on screen; saving it will ask to load the latest first.
          setToast('Another organiser just saved changes to the office.');
          return;
        }
        controllerRef.current?.setLayout(layout);
        if (by !== myId) setToast('The office was rearranged by the organiser.');
      },
      onOwnCharacter(character: string) {
        controllerRef.current?.setOwnCharacter(character);
        setWorkspace((w) => (w ? { ...w, character } : w));
      },
      onOwnStatus(status) {
        controllerRef.current?.setOwnStatus(status);
        setWorkspace((w) => (w ? { ...w, status } : w));
      },
      onDesks(desks) {
        controllerRef.current?.setDesks(desks);
        setWorkspace((w) => (w ? { ...w, desks, deskId: desks.find((d) => d.userId === myId)?.deskId ?? null } : w));
      },
      onConnection: setOnline,
      onRemoved: (reason) => void leave(reason),
    });

    (async () => {
      // Phaser touches `window`, so it is loaded only here, in the browser.
      const [{ createGame }] = await Promise.all([import('@/game/createGame'), document.fonts.ready]);
      if (cancelled || !containerRef.current) return;
      game = createGame(containerRef.current, {
        layout: workspace.layout,
        myId,
        character: workspace.character,
        name,
        status: workspace.status,
        desks: workspace.desks,
        fontFamily: getComputedStyle(document.body).fontFamily,
        onMove: connection.sendMove,
        onZone: connection.sendZone,
      });
      controllerRef.current = game;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      connection.disconnect();
      game?.destroy();
      controllerRef.current = null;
      setReady(false);
    };
    // The game is created once per office; later changes arrive through the controller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, myId, name]);

  // ---- office editor ---------------------------------------------------------------

  const startEditing = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller || !workspace || editingRef.current) return;
    const editor = new LayoutEditor(workspace.layout);
    controller.startEditing(editor, setToast);
    setEditError(null);
    setEditing({ editor, baseVersion: workspace.layoutVersion });
  }, [workspace]);

  const stopEditing = useCallback((layout: OfficeLayout) => {
    controllerRef.current?.setLayout(layout);
    setEditing(null);
    setEditError(null);
  }, []);

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
  }, [editing, stopEditing]);

  const reloadLatest = useCallback(async () => {
    const latest = await api<MyWorkspace>('/workspace').catch(() => null);
    if (!latest) return;
    versionRef.current = Math.max(versionRef.current, latest.layoutVersion);
    setWorkspace(latest);
    stopEditing(latest.layout);
  }, [stopEditing]);

  // Unsaved changes: ask before leaving the page.
  useEffect(() => {
    if (!editing) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (editing.editor.getState().dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing]);

  // Until the task manager (Z5) and meeting tools (Z4) listen to E, say what's there.
  useEffect(
    () =>
      officeEvents.on('object:interact', (e) => {
        if (e.type === 'board') return setToast('Screen: sharing arrives with the meeting rooms.');
        const whose = !e.ownerId ? `${e.name} is free.` : e.ownerId === myId ? 'Your desk.' : `${e.name}.`;
        setToast(`${whose} Tasks will open here.`);
      }),
    [myId],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#e4e0da]">
      <div ref={containerRef} className="absolute inset-0" />
      {/* Soft vignette for depth; ignores the mouse. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(24_24_27/0.18))]" />
      <OfficeHud
        controller={ready ? controllerRef.current : null}
        workspace={workspace}
        people={people}
        toast={toast}
        online={online}
        editing={!!editing}
        onEdit={startEditing}
      />
      {editing && (
        <EditorPanel
          editor={editing.editor}
          saving={saving}
          error={editError}
          onSave={save}
          onDiscard={discard}
          onReload={reloadLatest}
        />
      )}
    </div>
  );
}
