/**
 * Real-time event bus and event payload types for workspace live updates.
 */

import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { OfficeLayout } from '../office/layout/types';
import type { DeskOwner } from './desks.service';

/** Union of real-time domain events broadcast to connected workspace clients. */
export type WorkspaceEvent =
  | { type: 'layout'; workspaceId: string; layout: OfficeLayout; version: number; by: string }
  | { type: 'member-removed'; workspaceId: string; userId: string }
  | { type: 'member-updated'; workspaceId: string; userId: string; character?: string; role?: string; status?: string | null }
  | { type: 'desks'; workspaceId: string; desks: DeskOwner[] }
  /** Bookings were removed (e.g. rooms gone after a template switch): clients reload them. */
  | { type: 'bookings'; workspaceId: string }
  | { type: 'deleted'; workspaceId: string };

/** In-memory event bus relaying real-time workspace state changes to subscribers. */
@Injectable()
export class WorkspaceEvents {
  readonly events$ = new Subject<WorkspaceEvent>();

  /** Emits a workspace event to all active event stream subscribers. */
  emit(event: WorkspaceEvent) {
    this.events$.next(event);
  }
}

