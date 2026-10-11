/**
 * In-process session revocation event bus.
 * Notifies WebSocket gateways when sessions are terminated so active sockets are immediately disconnected.
 */
import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

/** Enumeration of reasons why a user device session was terminated. */
export type SessionEndReason =
  | 'signed_out'
  | 'sessions_closed'
  | 'signed_in_elsewhere'
  | 'password_changed'
  | 'security_alert';

/** Payload containing revoked session family identifiers and the termination reason. */
export interface SessionsEnded {
  familyIds: string[];
  reason: SessionEndReason;
}

/**
 * Event emitter propagating session termination events across the application to trigger immediate socket disconnections.
 */
@Injectable()
export class SessionEvents {
  readonly ended$ = new Subject<SessionsEnded>();

  emit(familyIds: string[], reason: SessionEndReason) {
    if (familyIds.length > 0) this.ended$.next({ familyIds, reason });
  }
}

