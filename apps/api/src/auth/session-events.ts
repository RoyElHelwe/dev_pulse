import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

/** Why a device was signed out; the frontend shows a matching message. */
export type SessionEndReason =
  | 'signed_out'
  | 'sessions_closed'
  | 'signed_in_elsewhere'
  | 'password_changed'
  | 'security_alert';

export interface SessionsEnded {
  familyIds: string[];
  reason: SessionEndReason;
}

/**
 * Tells the rest of the app that sessions were revoked, so open tabs on those
 * devices are signed out right away (see SessionGateway), not 15 minutes later.
 */
@Injectable()
export class SessionEvents {
  readonly ended$ = new Subject<SessionsEnded>();

  emit(familyIds: string[], reason: SessionEndReason) {
    if (familyIds.length > 0) this.ended$.next({ familyIds, reason });
  }
}
