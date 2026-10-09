'use client';

/**
 * Foosball (Baby foot) Mouse Controls:
 * (1) FLICK: track pointermove samples (time, cursor y logical) over the last ~50 ms;
 *     vertical speed in table-heights/s v = |dy over window| / (PH=64*SCALE logical units) / (window seconds);
 *     if v >= 3.5 and kick cooldown (0.35 s) elapsed => send kick {rod: active, strength: clamp(0.35 + (v-3.5)/6, 0.35, 1)}.
 * (2) CLICK: a pointerdown button 0 that did not select a rod sends kick with strength
 *     max(0.6, strength from current speed v, same formula).
 * Client cooldown 0.35 s between kicks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CANVAS_H,
  CANVAS_W,
  FIELD_L,
  FIELD_W,
  OFFSET_X,
  OFFSET_Y,
  ROD_TRAVEL_LIMITS,
  ROD_X_A,
  ROD_X_B,
  SCALE,
  type FoosballAction,
  type FoosballPhase,
  type FoosballSide,
} from './constants';

const MIN_CX = OFFSET_X;
const MAX_CX = OFFSET_X + FIELD_L * SCALE;
const MIN_CY = OFFSET_Y;
const MAX_CY = OFFSET_Y + FIELD_W * SCALE;
const PITCH_H = FIELD_W * SCALE; // 256 logical units
const KICK_COOLDOWN_MS = 350; // 0.35 s
const AIM_THROTTLE_MS = 33;
const AIM_DELTA_THRESHOLD = 0.15;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeTargetOffset(cy: number, rod: number): number {
  const fy = (cy - OFFSET_Y) / SCALE;
  const halfFieldW = FIELD_W / 2; // 32
  const normalized = clamp((fy - halfFieldW) / halfFieldW, -1, 1);
  const limit = ROD_TRAVEL_LIMITS[rod] ?? 0;
  return normalized * limit;
}

export interface UseFoosballMouseParams {
  stageRef?: React.RefObject<HTMLElement | null>;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
  you: { side: FoosballSide; rods: number[] } | null;
  phase: FoosballPhase;
  send: (action: FoosballAction) => void;
}

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

  const activeRodRef = useRef(activeRod);
  activeRodRef.current = activeRod;

  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const youRef = useRef(you);
  youRef.current = you;

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const sendRef = useRef(send);
  sendRef.current = send;

  const lastKickTimeRef = useRef<number>(0);
  const moveSamplesRef = useRef<Array<{ time: number; y: number }>>([]);

  const lastSentAimRef = useRef<{ rod: number; y: number; time: number } | null>(null);
  const pendingAimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAimValueRef = useRef<{ rod: number; y: number } | null>(null);

  // Ensure activeRod stays valid when owned rods change
  useEffect(() => {
    if (you && you.rods.length > 0 && !you.rods.includes(activeRod)) {
      setActiveRod(you.rods[0]);
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
    if (phaseRef.current !== 'playing') return;
    const currentYou = youRef.current;
    if (!currentYou || !currentYou.rods.includes(rod)) return;

    sendRef.current({ type: 'aim', rod, y: targetY });
    lastSentAimRef.current = { rod, y: targetY, time: performance.now() };
  }, []);

  const scheduleAim = useCallback(
    (rod: number, targetY: number) => {
      if (phaseRef.current !== 'playing') return;
      const currentYou = youRef.current;
      if (!currentYou || !currentYou.rods.includes(rod)) return;

      const now = performance.now();
      const lastSent = lastSentAimRef.current;

      // If switching rods or never sent, send immediately
      if (!lastSent || lastSent.rod !== rod) {
        clearAimTimers();
        sendAimNow(rod, targetY);
        return;
      }

      // Check change threshold
      if (Math.abs(targetY - lastSent.y) <= AIM_DELTA_THRESHOLD) {
        pendingAimValueRef.current = { rod, y: targetY };
        return;
      }

      const elapsed = now - lastSent.time;
      if (elapsed >= AIM_THROTTLE_MS) {
        clearAimTimers();
        sendAimNow(rod, targetY);
      } else {
        // Record pending value for trailing send
        pendingAimValueRef.current = { rod, y: targetY };
        if (pendingAimTimerRef.current === null) {
          const delay = AIM_THROTTLE_MS - elapsed;
          pendingAimTimerRef.current = setTimeout(() => {
            pendingAimTimerRef.current = null;
            if (phaseRef.current !== 'playing') return;
            const pending = pendingAimValueRef.current;
            if (pending && pending.rod === activeRodRef.current) {
              const currentLast = lastSentAimRef.current;
              if (
                !currentLast ||
                currentLast.rod !== pending.rod ||
                Math.abs(pending.y - currentLast.y) > AIM_DELTA_THRESHOLD
              ) {
                sendAimNow(pending.rod, pending.y);
              }
            }
            pendingAimValueRef.current = null;
          }, delay);
        }
      }
    },
    [clearAimTimers, sendAimNow],
  );

  const switchToRod = useCallback(
    (newRod: number) => {
      const currentYou = youRef.current;
      if (!currentYou || !currentYou.rods.includes(newRod)) return;
      if (newRod === activeRodRef.current) return;

      setActiveRod(newRod);
      activeRodRef.current = newRod;

      clearAimTimers();

      // Immediately send aim for the newly active rod
      if (phaseRef.current === 'playing') {
        const targetOffset = computeTargetOffset(cursorPosRef.current.y, newRod);
        sendAimNow(newRod, targetOffset);
      }
    },
    [clearAimTimers, sendAimNow],
  );

  const computeCurrentSpeed = useCallback((now: number): number => {
    const samples = moveSamplesRef.current;
    if (samples.length < 2) return 0;
    const oldest = samples[0];
    const newest = samples[samples.length - 1];
    const dtSec = (newest.time - oldest.time) / 1000;
    if (dtSec < 0.015) return 0;
    const dy = Math.abs(newest.y - oldest.y);
    return dy / PITCH_H / dtSec;
  }, []);

  const handlePointerMovement = useCallback(
    (e: { clientX: number; clientY: number; movementX?: number; movementY?: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const now = performance.now();

      if (lockedRef.current) {
        // Integrate movementX/movementY scaled by logical/css ratio
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;
        cursorPosRef.current.x = clamp(
          cursorPosRef.current.x + (e.movementX ?? 0) * scaleX,
          0,
          CANVAS_W,
        );
        cursorPosRef.current.y = clamp(
          cursorPosRef.current.y + (e.movementY ?? 0) * scaleY,
          0,
          CANVAS_H,
        );
      } else {
        // Unlocked fallback: clientX/Y relative to canvas rect
        const cx = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
        const cy = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
        cursorPosRef.current.x = clamp(cx, 0, CANVAS_W);
        cursorPosRef.current.y = clamp(cy, 0, CANVAS_H);
      }

      const currentCy = cursorPosRef.current.y;

      // Track movement samples for flick detection over ~50 ms
      const samples = moveSamplesRef.current;
      samples.push({ time: now, y: currentCy });
      while (samples.length > 1 && now - samples[0].time > 55) {
        samples.shift();
      }

      // Check Rule (1): FLICK kick
      if (phaseRef.current === 'playing' && youRef.current) {
        const active = activeRodRef.current;
        if (youRef.current.rods.includes(active) && samples.length >= 2) {
          const oldest = samples[0];
          const newest = samples[samples.length - 1];
          const dtSec = (newest.time - oldest.time) / 1000;
          if (dtSec >= 0.015) {
            const dy = Math.abs(newest.y - oldest.y);
            const v = dy / PITCH_H / dtSec; // table-heights/s

            if (v >= 3.5 && now - lastKickTimeRef.current >= KICK_COOLDOWN_MS) {
              const strength = clamp(0.35 + (v - 3.5) / 6, 0.35, 1);
              sendRef.current({ type: 'kick', rod: active, strength });
              lastKickTimeRef.current = now;
              samples.length = 0;
            }
          }
        }
      }

      // Aim active rod
      const targetOffset = computeTargetOffset(currentCy, activeRodRef.current);
      scheduleAim(activeRodRef.current, targetOffset);
    },
    [canvasRef, scheduleAim],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (document.pointerLockElement === canvasRef.current) {
        return;
      }
      handlePointerMovement(e);
    },
    [canvasRef, handlePointerMovement],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      if (!lockedRef.current && rect.width > 0 && rect.height > 0) {
        const cx = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
        const cy = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
        cursorPosRef.current.x = clamp(cx, 0, CANVAS_W);
        cursorPosRef.current.y = clamp(cy, 0, CANVAS_H);
      }

      const cx = cursorPosRef.current.x;
      const cy = cursorPosRef.current.y;
      const fx = (cx - OFFSET_X) / SCALE;

      const currentYou = youRef.current;
      const currentPhase = phaseRef.current;

      // Check selecting a rod
      let selectedNewRod = false;
      if (currentYou && currentYou.side) {
        const rodXList = currentYou.side === 'A' ? ROD_X_A : ROD_X_B;
        let closestRod = -1;
        let closestDist = Infinity;

        for (const rod of currentYou.rods) {
          const rx = rodXList[rod];
          const dist = Math.abs(fx - rx);
          if (dist <= 6 && dist < closestDist) {
            closestDist = dist;
            closestRod = rod;
          }
        }

        if (closestRod !== -1 && closestRod !== activeRodRef.current) {
          switchToRod(closestRod);
          selectedNewRod = true;
        }
      }

      // Pointer lock request on pointerdown when seated and playing
      if (currentYou && currentPhase === 'playing') {
        if (canvas && document.pointerLockElement !== canvas) {
          try {
            const p = canvas.requestPointerLock?.();
            if (p && typeof (p as Promise<void>).catch === 'function') {
              (p as Promise<void>).catch(() => {});
            }
          } catch {}
        }
      }

      // Rule (2): CLICK kick (when click did not select a rod)
      if (!selectedNewRod && currentYou && currentPhase === 'playing') {
        const active = activeRodRef.current;
        if (currentYou.rods.includes(active)) {
          const now = performance.now();
          if (now - lastKickTimeRef.current >= KICK_COOLDOWN_MS) {
            const v = computeCurrentSpeed(now);
            const speedStrength = v >= 3.5 ? clamp(0.35 + (v - 3.5) / 6, 0.35, 1) : 0;
            const strength = Math.max(0.6, speedStrength);
            sendRef.current({ type: 'kick', rod: active, strength });
            lastKickTimeRef.current = now;
            moveSamplesRef.current.length = 0;
          }
        }
      }

      // If playing, update aim for current cursor position
      if (
        currentPhase === 'playing' &&
        currentYou &&
        currentYou.rods.includes(activeRodRef.current)
      ) {
        const targetOffset = computeTargetOffset(cy, activeRodRef.current);
        scheduleAim(activeRodRef.current, targetOffset);
      }
    },
    [canvasRef, computeCurrentSpeed, scheduleAim, switchToRod],
  );

  // Document pointermove listener while locked
  useEffect(() => {
    if (!locked) return;

    const onDocPointerMove = (e: PointerEvent) => {
      if (document.pointerLockElement === canvasRef.current) {
        handlePointerMovement(e);
      }
    };

    document.addEventListener('pointermove', onDocPointerMove);
    return () => {
      document.removeEventListener('pointermove', onDocPointerMove);
    };
  }, [canvasRef, handlePointerMovement, locked]);

  // Stage pointer listeners
  useEffect(() => {
    const stage = stageRef?.current;
    if (!stage) return;

    let lastHandledEvent: PointerEvent | null = null;
    const onStagePointerMove = (e: PointerEvent) => {
      if (document.pointerLockElement === canvasRef.current) return;
      if (e === lastHandledEvent) return;
      lastHandledEvent = e;
      handlePointerMovement(e);
    };

    const onStagePointerDown = (e: PointerEvent) => {
      onPointerDown(e as unknown as React.PointerEvent<HTMLElement>);
    };

    stage.addEventListener('pointerdown', onStagePointerDown);
    stage.addEventListener('pointermove', onStagePointerMove);

    return () => {
      stage.removeEventListener('pointerdown', onStagePointerDown);
      stage.removeEventListener('pointermove', onStagePointerMove);
    };
  }, [stageRef, canvasRef, handlePointerMovement, onPointerDown]);

  // Pointer lock change, window blur, and cleanup
  useEffect(() => {
    const onLockChange = () => {
      const isLocked = document.pointerLockElement === canvasRef.current;
      setLocked(isLocked);
      lockedRef.current = isLocked;
    };

    const onBlur = () => {
      if (document.pointerLockElement && document.pointerLockElement === canvasRef.current) {
        try {
          document.exitPointerLock?.();
        } catch {}
      }
      clearAimTimers();
      moveSamplesRef.current.length = 0;
    };

    document.addEventListener('pointerlockchange', onLockChange);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('pointerlockchange', onLockChange);
      window.removeEventListener('blur', onBlur);
      if (document.pointerLockElement && document.pointerLockElement === canvasRef.current) {
        try {
          document.exitPointerLock?.();
        } catch {}
      }
      clearAimTimers();
    };
  }, [canvasRef, clearAimTimers]);

  // Exit pointer lock and clear timers when leaving playing phase
  useEffect(() => {
    if (phase !== 'playing') {
      if (document.pointerLockElement && document.pointerLockElement === canvasRef.current) {
        try {
          document.exitPointerLock?.();
        } catch {}
      }
      clearAimTimers();
      moveSamplesRef.current.length = 0;
    }
  }, [canvasRef, clearAimTimers, phase]);

  const bindCanvas = useCallback(
    (node: HTMLCanvasElement | null) => {
      internalCanvasRef.current = node;
      if (externalCanvasRef) {
        (externalCanvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = node;
      }
    },
    [externalCanvasRef],
  );

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