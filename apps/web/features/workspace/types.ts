// Workspace domain types and role permission utilities.
// Used across office, team, and onboarding feature modules.

import type { DeskOwner } from '@/game/createGame';
import type { OfficeLayout } from '@/game/layout/types';

/** Hierarchical workspace authorization level determining administrative privileges. */
export type Role = 'OWNER' | 'ADMIN' | 'MEMBER';

interface OfficeWingInfo {
  id: string;
  side: 'LEFT' | 'RIGHT' | 'BOTTOM';
  x: number;
  y: number;
  w: number;
  h: number;
  deskCount: number;
}

/** GET /api/workspace: everything the office page needs. */
export interface MyWorkspace {
  id: string;
  name: string;
  templateId: string;
  layout: OfficeLayout;
  layoutVersion: number;
  role: Role;
  character: string;
  status: string | null;
  deskId: string | null;
  desks: DeskOwner[];
  memberCount: number;
  wings: OfficeWingInfo[];
  canExpand: boolean;
  canAddChill?: boolean;
}

/** Determines whether the given role has administrative permissions to manage the workspace. */
export function canManage(role: Role | undefined) {
  return role === 'OWNER' || role === 'ADMIN';
}

/** User-facing display labels for each workspace authorization tier. */
export const ROLE_LABEL: Record<Role, string> = { OWNER: 'Organiser', ADMIN: 'Admin', MEMBER: 'Member' };
