/**
 * Main office view orchestrating game canvas, board drawer, HUD, and live features.
 * Composes socket connection, layout editing, and desk interaction hooks into the layout.
 */

'use client';

import { useCallback, useRef } from 'react';
import { BoardDrawer } from '@/features/tasks/BoardDrawer';
import { TaskBoard } from '@/features/tasks/TaskBoard';
import type { BoardFilter } from '@/features/tasks/types';
import { EditorPanel } from './EditorPanel';
import { MoveDeskPrompt } from './MoveDeskPrompt';
import { OfficeFeatures } from './OfficeFeatures';
import { OfficeHud } from './OfficeHud';
import { OfficeOverlays } from './OfficeOverlays';
import { useDeskInteractions } from './useDeskInteractions';
import { useOfficeBoard } from './useOfficeBoard';
import { useOfficeConnection } from './useOfficeConnection';
import { useOfficeEditor } from './useOfficeEditor';

/** Full-screen office: the Phaser canvas, the live connection and the HUD. */
export function OfficeView() {
  const isEditingRef = useRef(false);

  const {
    containerRef,
    workspace,
    setWorkspace,
    people,
    toast,
    setToast,
    online,
    socket,
    ready,
    controller,
    versionRef,
    user,
    myId,
  } = useOfficeConnection({ isEditingRef });

  const {
    editing,
    saving,
    editError,
    startEditing,
    discard,
    save,
    resetToTemplate,
    reloadLatest,
  } = useOfficeEditor({
    workspace,
    setWorkspace,
    controller,
    setToast,
    versionRef,
  });

  const isEditing = !!editing;
  isEditingRef.current = isEditing;

  const {
    boardOpen,
    setBoardOpen,
    boardFilter,
    setBoardFilter,
    closeBoard,
    toggleBoard,
    pushView,
    setGameOpen,
  } = useOfficeBoard({
    socket,
    controller,
    ready,
    isEditing,
  });

  const {
    moveTo,
    moving,
    moveDesk,
    cancelMove,
  } = useDeskInteractions({
    myId,
    desks: workspace?.desks,
    setToast,
    onOpenBoard: useCallback(
      (filter: BoardFilter) => {
        setBoardFilter(filter);
        setBoardOpen(true);
      },
      [setBoardFilter, setBoardOpen],
    ),
  });

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
            controller={controller}
            workspace={workspace}
            people={people}
            editing={isEditing}
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
              onCancel={cancelMove}
            />
          )}
          {/* Kept mounted while editing, so calls and chat carry on (they hide their UI). */}
          {workspace && myId && user && (
            <OfficeFeatures
              user={user}
              myId={myId}
              workspace={workspace}
              people={people}
              socket={socket}
              controller={controller}
              editing={isEditing}
              onToast={setToast}
              onGameOpenChange={setGameOpen}
            />
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
      {/* Outside the pushed layer, so they stay visible while the board is open. */}
      <OfficeOverlays toast={toast} online={online} editing={isEditing} />
    </div>
  );
}
