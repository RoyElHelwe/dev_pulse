'use client';

/**
 * Custom hook encapsulating Lego game session state, art synchronization, and interactions.
 * Connects socket game sessions, tracks brick dimensions and tool states, and dispatches actions.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { LEGO_BASE_SHAPES, legoArt } from '@/game/render/legoArt';
import { useGameChromeInfo } from '../GameChrome';
import { useGameSession } from '../useGameSession';
import { computeSquareCellSize, getEffectiveShape } from './legoBoardGeometry';
import {
  BOARD_HEIGHT_STUDS,
  BOARD_WIDTH_STUDS,
  DEFAULT_CELL_SIZE_PX,
  DEFAULT_COLOR_INDEX,
  DEFAULT_SHAPE_INDEX,
  ERROR_DISMISS_DELAY_MS,
  type LegoState,
  MIN_CELL_SIZE_PX,
} from './legoConstants';

/**
 * Manages game state, active selection tools, and canvas container sizing for the Lego board.
 */
export function useLegoBoard(objectId: string, socket: Socket | null | undefined) {
  const { state, status, error, send } = useGameSession<LegoState>(socket, 'lego', objectId);

  useGameChromeInfo({
    players: state?.players ? state.players.length : null,
  });

  const [shapeIndex, setShapeIndex] = useState(DEFAULT_SHAPE_INDEX);
  const [rotated, setRotated] = useState(false);
  const [colorIndex, setColorIndex] = useState(DEFAULT_COLOR_INDEX);
  const [isErasing, setIsErasing] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [cellSize, setCellSize] = useState(DEFAULT_CELL_SIZE_PX);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Measure available container space to compute responsive square cell size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCellSize = (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      const computed = computeSquareCellSize(w, h, BOARD_WIDTH_STUDS, BOARD_HEIGHT_STUDS, MIN_CELL_SIZE_PX);
      setCellSize(computed);
    };

    const rect = container.getBoundingClientRect();
    updateCellSize(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        updateCellSize(width, height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Mirror state.bricks into legoArt.set(objectId, bricks) so the wall miniature updates instantly
  useEffect(() => {
    if (state?.bricks) {
      legoArt.set(objectId, state.bricks);
    }
  }, [objectId, state?.bricks]);

  const showBriefError = useCallback((msg: string) => {
    setBriefError(msg);
  }, []);

  useEffect(() => {
    if (error) {
      setBriefError(error.message || error.code);
    }
  }, [error]);

  useEffect(() => {
    if (briefError) {
      const timer = setTimeout(() => setBriefError(null), ERROR_DISMISS_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [briefError]);

  // Keyboard shortcut 'R' for toggling brick orientation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setRotated((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const baseShape = LEGO_BASE_SHAPES[shapeIndex] ?? LEGO_BASE_SHAPES[0];
  const effectiveShape = getEffectiveShape(baseShape, rotated);

  const selectShape = useCallback((idx: number) => {
    setShapeIndex(idx);
    setIsErasing(false);
  }, []);

  const toggleRotate = useCallback(() => {
    setRotated((prev) => !prev);
  }, []);

  const toggleErasing = useCallback(() => {
    setIsErasing((prev) => !prev);
  }, []);

  const selectColor = useCallback((idx: number) => {
    setColorIndex(idx);
    setIsErasing(false);
  }, []);

  const placeBrick = useCallback(
    (x: number, y: number, w: number, h: number, c: number) => {
      send({ type: 'place', x, y, w, h, c });
    },
    [send],
  );

  const removeBrick = useCallback(
    (x: number, y: number) => {
      send({ type: 'remove', x, y });
    },
    [send],
  );

  const clearBoard = useCallback(() => {
    send({ type: 'clear' });
  }, [send]);

  return {
    state,
    status,
    briefError,
    cellSize,
    containerRef,
    effectiveShape,
    shapeIndex,
    isRotated: rotated,
    colorIndex,
    isErasing,
    showBriefError,
    selectShape,
    toggleRotate,
    toggleErasing,
    selectColor,
    placeBrick,
    removeBrick,
    clearBoard,
  };
}
