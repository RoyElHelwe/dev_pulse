/**
 * Common type definitions for backend services
 */

export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UserContext {
  id: string;
  email: string;
  name?: string;
  sessionId?: string;
  workspaceId?: string;
  role?: string;
}

export interface RequestWithUser extends Request {
  user?: UserContext;
}

export type MemberStatus = 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY';
export type MemberRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
