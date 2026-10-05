import type { OfficeLayout } from '@/game/layout/types';

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER';

/** GET /api/workspace: everything the office page needs. */
export interface MyWorkspace {
  id: string;
  name: string;
  templateId: string;
  layout: OfficeLayout;
  layoutVersion: number;
  role: Role;
  character: string;
  memberCount: number;
}

/** Owners and admins invite people and edit the office. */
export function canManage(role: Role | undefined) {
  return role === 'OWNER' || role === 'ADMIN';
}

export const ROLE_LABEL: Record<Role, string> = { OWNER: 'Organiser', ADMIN: 'Admin', MEMBER: 'Member' };
