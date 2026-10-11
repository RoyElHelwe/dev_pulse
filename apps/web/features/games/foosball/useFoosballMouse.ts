'use client';

/**
 * Foosball mouse and pointer-lock interaction hook.
 * Wires DOM pointer events to rod targeting, rod selection, flick kicks, and click kicks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FIELD_L,
  FIELD_W,
  OFFSET_X,
  OFFSET_Y,
  SCALE,
  type FoosballAction,
  type FoosballPhase,
  type FoosballSide,
} from './constants';
import {
  calculateClickKickStrength,
  detectFlickKick,
  pruneOldSamples,
  type PointerSample,
} from './foosballKick';
import {
  canvasToFieldX,
  clientToLogicalPos,
  computeTargetOffset,
  findClosestOwnedRod,
  integrateLockedMovement,
  safeExitPointerLock,
  safeRequestPointerLock,
  shouldSendImmediateAim,
  type AimRecord,
} from './foosballPointer';

/** Network aim message throttling rate in milliseconds (~30 Hz). */
const AIM_THROTTLE_MS = 33;

/** Minimum rod offset delta in units required to trigger an aim update. */
const AIM_DELTA_THRESHOLD_UNITS = 0.15;

/** Container refs, player rod assignments, match phase, and network dispatcher to handle foosball pointer inputs. */
export interface UseFoosballMouseParams {
  stageRef?: React.RefObject<HTMLElement | null>;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  you: { side: FoosballSide; rods: number[] } | null;
  phase: FoosballPhase;
  send: (action: FoosballAction) => void;
}

/** Active rod index, pointer lock state, cursor coordinate ref, and canvas event handlers for controlling the table. */
export interface UseFoosballMouseReturn {
  activeRod: number;
  selectRod: (rod: number) => void;
  locked: boolean;
  cursorPosRef: React.RefObject<{ x: number; y: number }>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  bindCanvas: (node: HTMLCanvasElement | null) => void;
}

/** Handles pointer movement, pointer lock, rod switching, and kick gestures for foosball. */
export function useFoosballMouse({
  stageRef,
  canvasRef: externalCanvasRef,
  you,
  phase,
  send,
}: UseFoosballMouseParams): UseFoosballMouseReturn {
  const [activeRod, setActiveRod] = useState<number>(() => you?.rods[0] ?? 0);
  const [locked, setLocked] = useState(false);

  const internalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = externalCanvasRef ?? internalCanvasRef;

  const cursorPosRef = useRef<{ x: number; y: number }>({
    x: OFFSET_X + (FIELD_L * SCALE) / 2,
    y: OFFSET_Y + (FIELD_W * SCALE) / 2,
  });

  const stateRef = useRef({ activeRod, locked, you, phase, send });
  stateRef.current = { activeRod, locked, you, phase, send };

  const lastKickTimeRef = useRef<number>(0);
  const moveSamplesRef = useRef<PointerSample[]>([]);
  const lastSentAimRef = useRef<AimRecord | null>(null);
  const pendingAimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAimValueRef = useRef<{ rod: number; y: number } | null>(null);

  useEffect(() => {
    if (you && you.rods.length > 0 && !you.rods.includes(activeRod)) {
      setActiveRod(you.rods[0] ?? 0);
    }
  }, [you, activeRod]);

  const clearAimTimers = useCallback(() => {
    if (pendingAimTimerRef.current !== null) {
      clearTimeout(pendingAimTimerRef.current);
      pendingAimTimerRef.current = null;
    }
    pendingAimValueRef.current = null;
  }, []);

  const sendAimNow = useCallback((rod: number, targetY: number) => {
    if (stateRef.current.phase !== 'playing') return;
    const currentYou = stateRef.current.you;
    if (!currentYou || !currentYou.rods.includes(rod)) return;
    stateRef.current.send({ type: 'aim', rod, y: targetY });
    lastSentAimRef.current = { rod, y: targetY, time: performance.now() };
  }, []);

  const scheduleAim = useCallback(
    (rod: number, targetY: number) => {
      if (stateRef.current.phase !== 'playing') return;
      const currentYou = stateRef.current.you;
      if (!currentYou || !currentYou.rods.includes(rod)) return;

      const now = performance.now();
      const { sendNow, exceedsThreshold } = shouldSendImmediateAim(
        lastSentAimRef.current,
        rod,
        targetY,
        now,
        AIM_DELTA_THRESHOLD_UNITS,
        AIM_THROTTLE_MS,
      );

      if (sendNow) {
        clearAimTimers();
        sendAimNow(rod, targetY);
        return;
      }

      pendingAimValueRef.current = { rod, y: targetY };
      if (!exceedsThreshold || pendingAimTimerRef.current !== null) return;

      const elapsed = now - (lastSentAimRef.current?.time ?? 0);
      pendingAimTimerRef.current = setTimeout(() => {
        pendingAimTimerRef.current = null;
        if (stateRef.current.phase !== 'playing') return;
        const pending = pendingAimValueRef.current;
        if (pending && pending.rod === stateRef.current.activeRod) {
          const curLast = lastSentAimRef.current;
          if (!curLast || curLast.rod !== pending.rod || Math.abs(pending.y - curLast.y) > AIM_DELTA_THRESHOLD_UNITS) {
            sendAimNow(pending.rod, pending.y);
          }
        }
        pendingAimValueRef.current = null;
      }, AIM_THROTTLE_MS - elapsed);
    },
    [clearAimTimers, sendAimNow],
  );

  const switchToRod = useCallback(
    (newRod: number) => {
      const currentYou = stateRef.current.you;
      if (!currentYou || !currentYou.rods.includes(newRod) || newRod === stateRef.current.activeRod) return;
      setActiveRod(newRod);
      clearAimTimers();
      if (stateRef.current.phase === 'playing') {
        sendAimNow(newRod, computeTargetOffset(cursorPosRef.current.y, newRod));
      }
    },
    [clearAimTimers, sendAimNow],
  );

  const handlePointerMovement = useCallback(
    (e: { clientX: number; clientY: number; movementX?: number; movementY?: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const now = performance.now();
      cursorPosRef.current = stateRef.current.locked
        ? integrateLockedMovement(cursorPosRef.current, e, rect)
        : clientToLogicalPos(e.clientX, e.clientY, rect);

      const currentCy = cursorPosRef.current.y;
      const samples = moveSamplesRef.current;
      samples.push({ time: now, y: currentCy });
      pruneOldSamples(samples, now);

      const curRod = stateRef.current.activeRod;
      if (stateRef.current.phase === 'playing' && stateRef.current.you?.rods.includes(curRod)) {
        const flick = detectFlickKick(samples, now, lastKickTimeRef.current);
        if (flick.kicked) {
          stateRef.current.send({ type: 'kick', rod: curRod, strength: flick.strength });
          lastKickTimeRef.current = now;
          samples.length = 0;
        }
      }

      scheduleAim(curRod, computeTargetOffset(currentCy, curRod));
    },
    [canvasRef, scheduleAim],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (document.pointerLockElement !== canvasRef.current) handlePointerMovement(e);
    },
    [canvasRef, handlePointerMovement],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      if (!stateRef.current.locked && rect.width > 0 && rect.height > 0) {
        cursorPosRef.current = clientToLogicalPos(e.clientX, e.clientY, rect);
      }

      const { x: cx, y: cy } = cursorPosRef.current;
      const { you: currentYou, phase: currentPhase, activeRod: curRod } = stateRef.current;
      let selectedNewRod = false;

      if (currentYou?.side) {
        const closest = findClosestOwnedRod(canvasToFieldX(cx), currentYou.rods, currentYou.side);
        if (closest !== -1 && closest !== curRod) {
          switchToRod(closest);
          selectedNewRod = true;
        }
      }

      if (currentYou && currentPhase === 'playing') safeRequestPointerLock(canvas);

      if (!selectedNewRod && currentYou && currentPhase === 'playing' && currentYou.rods.includes(curRod)) {
        const now = performance.now();
        const strength = calculateClickKickStrength(moveSamplesRef.current, now, lastKickTimeRef.current);
        if (strength !== null) {
          stateRef.current.send({ type: 'kick', rod: curRod, strength });
          lastKickTimeRef.current = now;
          moveSamplesRef.current.length = 0;
        }
      }

      if (currentPhase === 'playing' && currentYou?.rods.includes(curRod)) {
        scheduleAim(curRod, computeTargetOffset(cy, curRod));
      }
    },
    [canvasRef, scheduleAim, switchToRod],
  );

  useEffect(() => {
    if (!locked) return;
    const onDocMove = (e: PointerEvent) => {
      if (document.pointerLockElement === canvasRef.current) handlePointerMovement(e);
    };
    document.addEventListener('pointermove', onDocMove);
    return () => document.removeEventListener('pointermove', onDocMove);
  }, [canvasRef, handlePointerMovement, locked]);

  useEffect(() => {
    const stage = stageRef?.current;
    if (!stage) return;
    let lastHandled: PointerEvent | null = null;
    const onStageMove = (e: PointerEvent) => {
      if (document.pointerLockElement === canvasRef.current || e === lastHandled) return;
      lastHandled = e;
      handlePointerMovement(e);
    };
    const onStageDown = (e: PointerEvent) => onPointerDown(e as unknown as React.PointerEvent<HTMLElement>);
    stage.addEventListener('pointerdown', onStageDown);
    stage.addEventListener('pointermove', onStageMove);
    return () => {
      stage.removeEventListener('pointerdown', onStageDown);
      stage.removeEventListener('pointermove', onStageMove);
    };
  }, [stageRef, canvasRef, handlePointerMovement, onPointerDown]);

  useEffect(() => {
    const cleanup = () => {
      safeExitPointerLock(canvasRef.current);
      clearAimTimers();
      moveSamplesRef.current.length = 0;
    };
    const onLockChange = () => setLocked(document.pointerLockElement === canvasRef.current);

    if (phase !== 'playing') cleanup();
    document.addEventListener('pointerlockchange', onLockChange);
    window.addEventListener('blur', cleanup);
    return () => {
      document.removeEventListener('pointerlockchange', onLockChange);
      window.removeEventListener('blur', cleanup);
      cleanup();
    };
  }, [canvasRef, clearAimTimers, phase]);

  const bindCanvas = useCallback((node: HTMLCanvasElement | null) => {
    internalCanvasRef.current = node;
    if (externalCanvasRef) {
      (externalCanvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = node;
    }
  }, [externalCanvasRef]);

  return {
    activeRod,
    selectRod: switchToRod,
    locked,
    cursorPosRef,
    canvasRef,
    onPointerMove,
    onPointerDown,
    bindCanvas,
  };
}
