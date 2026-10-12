/**
 * Desk interaction and claim prompt hook.
 * Handles interactive object triggers, desk reassignment API calls, and prompt state.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_FILTER } from '@/features/tasks/BoardFilters';
import type { BoardFilter } from '@/features/tasks/types';
import type { DeskOwner } from '@/game/createGame';
import { api, ApiError } from '@/lib/api';
import { officeEvents } from './events';

interface UseDeskInteractionsOptions {
  myId?: string;
  desks?: DeskOwner[];
  setToast: (message: string) => void;
  onOpenBoard: (filter: BoardFilter) => void;
}

/** Manages desk interactions, prompt states, and desk reassignment requests. */
export function useDeskInteractions({
  myId,
  desks,
  setToast,
  onOpenBoard,
}: UseDeskInteractionsOptions) {
  const [moveTo, setMoveTo] = useState<{ deskId: string; name: string } | null>(null);
  const [moving, setMoving] = useState(false);
  const moveToRef = useRef(moveTo);
  moveToRef.current = moveTo;
  const desksRef = useRef(desks ?? []);
  desksRef.current = desks ?? [];

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
  }, [setToast]);

  // E at the wall board: everyone's tasks. E at your own desk: only yours.
  useEffect(
    () =>
      officeEvents.on('object:interact', (e) => {
        if (e.type === 'kanban') {
          return onOpenBoard({ ...EMPTY_FILTER, onlyMine: false });
        }
        if (e.type === 'board') return setToast('To share your screen, use Share screen inside a meeting room.');
        if (e.type !== 'desk') return; // game tables and the Lego wall belong to GameHost
        if (e.ownerId && e.ownerId === myId) {
          return onOpenBoard({ ...EMPTY_FILTER, onlyMine: true });
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
    [myId, moveDesk, onOpenBoard, setToast],
  );

  // The prompt goes away when you walk off, or when someone else takes the desk.
  useEffect(
    () => officeEvents.on('zone:leave', (z) => setMoveTo((m) => (m && m.deskId === z.id ? null : m))),
    [],
  );
  useEffect(() => {
    if (moveTo && desks?.some((d) => d.deskId === moveTo.deskId)) setMoveTo(null);
  }, [moveTo, desks]);

  return {
    moveTo,
    moving,
    moveDesk,
    cancelMove: () => setMoveTo(null),
  };
}
