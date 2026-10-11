// Shared helpers, formatting utilities, and types for the team management features.
// Used across team cards and the main TeamPage component.

import { ApiError } from '@/lib/api';
import type { OfficeLayout } from '@/game/layout/types';
import type { Role } from '@/features/workspace/types';

/** Milliseconds in a single 24-hour day. */
const MS_PER_DAY = 86_400_000;

export interface Member {
  userId: string;
  displayName: string;
  email: string;
  role: Role;
  character: string;
  deskId: string | null;
  joinedAt: string;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  expired: boolean;
}

export interface OfficeTemplate {
  id: string;
  name: string;
  description: string;
  maxTeam: number;
  layout: OfficeLayout;
}

export type WingSide = 'LEFT' | 'RIGHT' | 'BOTTOM';

/** Calculates full days remaining until an ISO date timestamp. */
export function daysUntil(date: string): number {
  return Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / MS_PER_DAY));
}

/** Extracts an error message from an unknown error or API rejection. */
export function getErrorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Could not reach the server.';
}
