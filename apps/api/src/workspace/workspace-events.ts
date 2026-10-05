import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { OfficeLayout } from '../office/layout/types';
import type { DeskOwner } from './desks.service';

export type WorkspaceEvent =
  | { type: 'layout'; workspaceId: string; layout: OfficeLayout; version: number; by: string }
  | { type: 'member-removed'; workspaceId: string; userId: string }
  | { type: 'member-updated'; workspaceId: string; userId: string; character?: string; role?: string; status?: string | null }
  | { type: 'desks'; workspaceId: string; desks: DeskOwner[] }
  | { type: 'deleted'; workspaceId: string };

/** Changes the live office must know about (see OfficeGateway). */
@Injectable()
export class WorkspaceEvents {
  readonly events$ = new Subject<WorkspaceEvent>();

  emit(event: WorkspaceEvent) {
    this.events$.next(event);
  }
}
