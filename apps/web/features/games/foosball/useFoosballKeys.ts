'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { matchesKey } from '@/features/settings/keybinds';
import type { FoosballAction, FoosballPhase, FoosballSide } from './constants';

interface UseFoosballKeysParams {
  you: { side: FoosballSide; rods: number[] } | null;
  phase: FoosballPhase;
  send: (action: FoosballAction) => void;
}

export function useFoosballKeys({ you, phase, send }: UseFoosballKeysParams) {
  const [activeRod, setActiveRod] = useState<number>(() => you?.rods[0] ?? 0);

  const activeRodRef = useRef(activeRod);
  activeRodRef.current = activeRod;

  const youRef = useRef(you);
  youRef.current = you;

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const sendRef = useRef(send);
  sendRef.current = send;

  const upPressedRef = useRef(false);
  const downPressedRef = useRef(false);
  const movingDirRef = useRef<Record<number, -1 | 0 | 1>>({});

  // Ensure activeRod stays valid when owned rods change
  useEffect(() => {
    if (you && you.rods.length > 0 && !you.rods.includes(activeRod)) {
      setActiveRod(you.rods[0]);
    }
  }, [you, activeRod]);

  const getTargetDir = useCallback((): -1 | 0 | 1 => {
    if (upPressedRef.current && !downPressedRef.current) return -1;
    if (downPressedRef.current && !upPressedRef.current) return 1;
    return 0;
  }, []);

  const updateMovement = useCallback(() => {
    const rod = activeRodRef.current;
    const targetDir = getTargetDir();
    const currentDir = movingDirRef.current[rod] ?? 0;
    if (targetDir !== currentDir) {
      movingDirRef.current[rod] = targetDir;
      sendRef.current({ type: 'move', rod, dir: targetDir });
    }
  }, [getTargetDir]);

  const switchToRod = useCallback(
    (newRod: number) => {
      const oldRod = activeRodRef.current;
      if (newRod === oldRod) return;

      // Stop previous rod movement if moving
      const oldDir = movingDirRef.current[oldRod] ?? 0;
      if (oldDir !== 0) {
        movingDirRef.current[oldRod] = 0;
        sendRef.current({ type: 'move', rod: oldRod, dir: 0 });
      }

      setActiveRod(newRod);
      activeRodRef.current = newRod;

      // Carry current direction to newly active rod if keys are held
      const targetDir = getTargetDir();
      if (targetDir !== 0) {
        movingDirRef.current[newRod] = targetDir;
        sendRef.current({ type: 'move', rod: newRod, dir: targetDir });
      }
    },
    [getTargetDir],
  );

  const releaseAllRods = useCallback(() => {
    upPressedRef.current = false;
    downPressedRef.current = false;
    for (const [rodKey, dir] of Object.entries(movingDirRef.current)) {
      const rod = Number(rodKey);
      if (dir !== 0) {
        movingDirRef.current[rod] = 0;
        sendRef.current({ type: 'move', rod, dir: 0 });
      }
    }
  }, []);

  // When phase leaves countdown/playing or player stands up, stop all rods
  useEffect(() => {
    const isPlayPhase = phase === 'playing' || phase === 'countdown';
    if (!you || !isPlayPhase) {
      releaseAllRods();
    }
  }, [you, phase, releaseAllRods]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const currentYou = youRef.current;
      const currentPhase = phaseRef.current;
      const isPlayPhase = currentPhase === 'playing' || currentPhase === 'countdown';
      if (!currentYou || !isPlayPhase) return;
      if (e.repeat) return;

      // FoosKick action
      if (matchesKey(e, 'foosKick')) {
        e.preventDefault();
        sendRef.current({ type: 'kick', rod: activeRodRef.current });
        return;
      }

      // FoosSwitch action (cycle through owned rods)
      if (matchesKey(e, 'foosSwitch')) {
        e.preventDefault();
        const rods = currentYou.rods;
        if (rods.length > 0) {
          const idx = rods.indexOf(activeRodRef.current);
          const nextRod = rods[(idx + 1) % rods.length];
          switchToRod(nextRod);
        }
        return;
      }

      // Direct selection 1-4
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') {
        const rodIndex = Number(e.code.replace('Digit', '')) - 1;
        if (currentYou.rods.includes(rodIndex)) {
          e.preventDefault();
          switchToRod(rodIndex);
          return;
        }
      }

      // Move rod: -1 is towards y=0 (up)
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        upPressedRef.current = true;
        updateMovement();
        return;
      }

      // Move rod: +1 is towards y=FIELD_W (down)
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault();
        downPressedRef.current = true;
        updateMovement();
        return;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const currentYou = youRef.current;
      const currentPhase = phaseRef.current;
      const isPlayPhase = currentPhase === 'playing' || currentPhase === 'countdown';
      if (!currentYou || !isPlayPhase) return;

      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        upPressedRef.current = false;
        updateMovement();
        return;
      }

      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault();
        downPressedRef.current = false;
        updateMovement();
        return;
      }
    };

    const onBlur = () => {
      releaseAllRods();
    };

    // Capture phase listener as requested
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      releaseAllRods();
    };
  }, [updateMovement, switchToRod, releaseAllRods]);

  return { activeRod, selectRod: switchToRod };
}
