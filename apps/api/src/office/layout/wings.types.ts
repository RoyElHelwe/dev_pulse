// Types and error definitions for procedural office wing extensions.

import type { OfficeLayout, Room, Wall } from './types';
import type { LayoutBuilder } from '../templates/builder';

/** Side of the office where a new wing can be attached. */
export type WingSide = 'LEFT' | 'RIGHT' | 'BOTTOM';

/** Bounding box and desk capacity metadata for an added wing. */
export interface WingInfo {
  x: number;
  y: number;
  w: number;
  h: number;
  deskCount: number;
}

/** Resulting layout, wing metadata, and coordinate shift after adding a wing. */
export interface WingResult {
  layout: OfficeLayout;
  wing: WingInfo;
  shift: { x: number; y: number };
}

/** Error thrown when a wing cannot be attached or fails layout validation. */
export class WingError extends Error {
  constructor(
    public code: 'NO_DOOR' | 'WING_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'WingError';
  }
}

/** Options controlling special wing generation variants. */
export interface AddWingOptions {
  special?: 'chill';
}

/** Linear interval [start, end] along an axis. */
export interface Span {
  start: number;
  end: number;
}

/** Complete planned rooms, walls, furniture builder, and spans for a new wing. */
export interface WingPlan {
  rooms: Room[];
  walls: Wall[];
  furniture: LayoutBuilder;
  extraSpan: Span;
  openSpan: Span;
  openAisle: Span;
  spawn?: { x: number; y: number };
}
