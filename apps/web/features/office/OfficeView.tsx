'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from '@/features/auth/AuthProvider';
import { useKeybind } from '@/features/settings/keybinds';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { MeetingsPanel } from '@/features/meetings/MeetingsPanel';
import { EMPTY_FILTER } from '@/features/tasks/BoardFilters';
import { useOpenTaskCounts, useTaskSync } from '@/features/tasks/store';
import { BoardDrawer } from '@/features/tasks/BoardDrawer';
import { TaskBoard } from '@/features/tasks/TaskBoard';
import type { BoardFilter } from '@/features/tasks/types';
import { VoiceControls } from '@/features/voice/VoiceControls';
import type { MyWorkspace } from '@/features/workspace/types';
import type { OfficeController } from '@/game/createGame';
import { LayoutEditor } from '@/game/editor/LayoutEditor';
import type { OfficeLayout } from '@/game/layout/types';
import { api, ApiError } from '@/lib/api';
import { connectOffice, type Presence } from './connection';
import { GameHost } from '@/features/games/GameHost';
import { LegoSync } from '@/features/games/lego/LegoSync';
import { EditorPanel } from './EditorPanel';
import { officeEvents } from './events';
import { MoveDeskPrompt } from './MoveDeskPrompt';
import { OfficeHud } from './OfficeHud';
import { TabLock } from './TabLock';

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
  const [socket, setSocket] = useState<Socket | null>(null);
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
    setSocket(connection.socket);

    (async () => {
      // Phaser touches `window`, so it is loaded only here, in the browser.
      const [{ createGame }] = await Promise.all([import('@/game/createGame'), document.fonts.ready]);
      if (cancelled || !containerRef.current) return;
      game = createGame(containerRef.current, {
        layout: workspace.layout,
        players: connection.players(),
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
      setSocket(null);
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

  // ---- task board --------------------------------------------------------------------

  useTaskSync(socket);
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardFilter, setBoardFilter] = useState<BoardFilter>(EMPTY_FILTER);
  const closeBoard = useCallback(() => setBoardOpen(false), []);
  const toggleBoard = useCallback(() => setBoardOpen((o) => !o), []);
  // The camera keeps the player in the part of the office that is still on screen.
  const pushView = useCallback((shift: number) => controllerRef.current?.setViewShift(shift), []);

  // ---- desk move (E at a free desk) ----
  const [moveTo, setMoveTo] = useState<{ deskId: string; name: string } | null>(null);
  const [moving, setMoving] = useState(false);
  const moveToRef = useRef(moveTo);
  moveToRef.current = moveTo;
  const desksRef = useRef(workspace?.desks ?? []);
  desksRef.current = workspace?.desks ?? [];
  const moveDesk = useCallback(async () => {
    const target = moveToRef.current;
    if (!target) return;
    setMoving(true);
    try {
      // The new desk list comes back on the socket (everyone's desks redraw live).
      await api('/workspace/me/desk', { method: 'PUT', body: { deskId: target.deskId } });
      setToast(`${target.name} is your desk now.`);
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Could not move your desk. Please try again.');
    } finally {
      setMoving(false);
      setMoveTo(null);
    }
  }, []);

  // E at the wall board: everyone's tasks. E at your own desk: only yours.
  useEffect(
    () =>
      officeEvents.on('object:interact', (e) => {
        if (e.type === 'kanban') {
          setBoardFilter((f) => ({ ...f, onlyMine: false }));
          return setBoardOpen(true);
        }
        if (e.type === 'board') return setToast('Screen: sharing arrives with the meeting rooms.');
        if (e.type !== 'desk') return; // game tables and the Lego wall belong to GameHost
        if (e.ownerId && e.ownerId === myId) {
          setBoardFilter({ ...EMPTY_FILTER, onlyMine: true });
          return setBoardOpen(true);
        }
        if (e.ownerId) {
          const owner = desksRef.current.find((d) => d.deskId === e.id);
          return setToast(owner ? `${e.name} is ${owner.name}’s desk.` : `${e.name}.`);
        }
        // A free desk: ask first; E again (or the button) moves you there.
        if (moveToRef.current?.deskId === e.id) return void moveDesk();
        setToast('');
        setMoveTo({ deskId: e.id, name: e.name });
      }),
    [myId, moveDesk],
  );

  // The prompt goes away when you walk off, or when someone else takes the desk.
  useEffect(
    () => officeEvents.on('zone:leave', (z) => setMoveTo((m) => (m && m.deskId === z.id ? null : m))),
    [],
  );
  useEffect(() => {
    if (moveTo && workspace?.desks.some((d) => d.deskId === moveTo.deskId)) setMoveTo(null);
  }, [moveTo, workspace?.desks]);

  // Paper stacks on the desks: one sheet per open task of the owner.
  const openTasks = useOpenTaskCounts();
  const gameController = ready ? controllerRef.current : null;
  useEffect(() => gameController?.setTaskCounts(openTasks), [gameController, openTasks]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const isEditing = !!editing;
  // The board closes for the editor and stays closed afterwards (it used to pop back open on save).
  useEffect(() => {
    if (isEditing) setBoardOpen(false);
  }, [isEditing]);
  useKeybind('board', toggleBoard, !isEditing);
  const features = useMemo(
    () => ({
      socket,
      controller: ready ? controllerRef.current : null,
      workspace: workspace!,
      people,
      myId: myId!,
      onToast: setToast,
      editing: isEditing,
    }),
    [socket, ready, workspace, people, myId, isEditing],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#e4e0da]">
      {/* The task board waits off-screen on the right; opening it pushes this whole layer (canvas + HUD) left. */}
      <BoardDrawer
        open={boardOpen && !isEditing}
        onOpenChange={setBoardOpen}
        onPush={pushView}
        drawer={
          workspace && myId && !isEditing ? (
            <TaskBoard
              open={boardOpen}
              onClose={closeBoard}
              filter={boardFilter}
              onFilterChange={setBoardFilter}
              myId={myId}
              role={workspace.role}
            />
          ) : null
        }
      >
      <div className="relative h-full w-full">
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
          boardOpen={boardOpen}
          onBoard={toggleBoard}
        />
        {moveTo && !isEditing && (
          <MoveDeskPrompt
            name={moveTo.name}
            hasDesk={!!workspace?.deskId}
            busy={moving}
            onMove={() => void moveDesk()}
            onCancel={() => setMoveTo(null)}
          />
        )}
        {/* Kept mounted while editing, so calls and chat carry on (they hide their UI). */}
        {workspace && myId && user && (
          <>
            <VoiceControls {...features} />
            <ChatPanel {...features} />
            <MeetingsPanel {...features} />
            <GameHost socket={socket} me={{ id: user.id, name: user.displayName, character: workspace.character }} />
            <LegoSync socket={socket} />
          </>
        )}
        {editing && (
          <EditorPanel
            editor={editing.editor}
            saving={saving}
            error={editError}
            onSave={save}
            onDiscard={discard}
            onReload={reloadLatest}
            onReset={resetToTemplate}
            onProblem={setToast}
          />
        )}
      </div>
      </BoardDrawer>
      <TabLock />
    </div>
  );
}
