import type { DeskOwner } from '@/game/createGame';
import type { OfficeLayout } from '@/game/layout/types';

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface OfficeWingInfo {
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
}

/** Owners and admins invite people and edit the office. */
export function canManage(role: Role | undefined) {
  return role === 'OWNER' || role === 'ADMIN';
}

export const ROLE_LABEL: Record<Role, string> = { OWNER: 'Organiser', ADMIN: 'Admin', MEMBER: 'Member' };
