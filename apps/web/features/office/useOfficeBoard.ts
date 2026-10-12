/**
 * Task board drawer, camera view shift, and rendering pause coordination.
 * Connects task store synchronization, board hotkey, and Phaser frame rate throttling.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useKeybind } from '@/features/settings/keybindStore';
import { EMPTY_FILTER } from '@/features/tasks/BoardFilters';
import { useOpenTaskCounts, useTaskSync } from '@/features/tasks/taskStore';
import type { BoardFilter } from '@/features/tasks/types';
import type { OfficeController } from '@/game/createGame';

const BOARD_SETTLE_DELAY_MS = 900;

interface UseOfficeBoardOptions {
  socket: Socket | null;
  controller: OfficeController | null;
  ready: boolean;
  isEditing: boolean;
}

/** Coordinates task board drawer visibility, filter state, and game engine throttling. */
export function useOfficeBoard({ socket, controller, ready, isEditing }: UseOfficeBoardOptions) {
  useTaskSync(socket);
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardFilter, setBoardFilter] = useState<BoardFilter>(EMPTY_FILTER);
  const closeBoard = useCallback(() => setBoardOpen(false), []);
  const toggleBoard = useCallback(() => setBoardOpen((o) => !o), []);

  // The camera keeps the player in the part of the office that is still on screen.
  const pushView = useCallback(
    (shift: number) => controller?.setViewShift(shift),
    [controller],
  );

  // Paper stacks on the desks: one sheet per open task of the owner.
  const openTasks = useOpenTaskCounts();
  useEffect(() => {
    if (ready && controller) controller.setTaskCounts(openTasks);
  }, [controller, ready, openTasks]);

  // The board closes for the editor and stays closed afterwards (it used to pop back open on save).
  useEffect(() => {
    if (isEditing) setBoardOpen(false);
  }, [isEditing]);
  useKeybind('board', toggleBoard, !isEditing);

  // Something covers the office: take Phaser off the frame clock.
  const [gameOpen, setGameOpen] = useState(false);
  const boardShown = boardOpen && !isEditing;
  const [boardSettled, setBoardSettled] = useState(false);

  useEffect(() => {
    if (!boardShown) return;
    const timer = setTimeout(() => setBoardSettled(true), BOARD_SETTLE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setBoardSettled(false);
    };
  }, [boardShown]);

  const pauseMode = gameOpen ? 'hidden' : boardSettled ? 'throttled' : null;
  useEffect(() => {
    if (!pauseMode || !ready || !controller) return;
    controller.setPaused(true, pauseMode);
    return () => {
      controller.setPaused(false);
    };
  }, [controller, pauseMode, ready]);

  return {
    boardOpen,
    setBoardOpen,
    boardFilter,
    setBoardFilter,
    closeBoard,
    toggleBoard,
    pushView,
    setGameOpen,
  };
}
