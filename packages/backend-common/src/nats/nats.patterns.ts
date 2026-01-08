/**
 * NATS Message Patterns for microservice communication
 * Organized by service domain
 */

// Auth Service Patterns
export const AUTH_PATTERNS = {
  // User operations
  VALIDATE_SESSION: 'auth.session.validate',
  GET_USER: 'auth.user.get',
  GET_USER_BY_EMAIL: 'auth.user.getByEmail',
  CREATE_USER: 'auth.user.create',
  UPDATE_USER: 'auth.user.update',
  DELETE_USER: 'auth.user.delete',

  // Session operations
  CREATE_SESSION: 'auth.session.create',
  REFRESH_SESSION: 'auth.session.refresh',
  INVALIDATE_SESSION: 'auth.session.invalidate',
  INVALIDATE_ALL_SESSIONS: 'auth.session.invalidateAll',

  // 2FA operations
  ENABLE_2FA: 'auth.2fa.enable',
  DISABLE_2FA: 'auth.2fa.disable',
  VERIFY_2FA: 'auth.2fa.verify',

  // Events
  USER_CREATED: 'auth.event.user.created',
  USER_UPDATED: 'auth.event.user.updated',
  USER_DELETED: 'auth.event.user.deleted',
  SESSION_CREATED: 'auth.event.session.created',
  SESSION_EXPIRED: 'auth.event.session.expired',
} as const;

// Workspace Service Patterns
export const WORKSPACE_PATTERNS = {
  // Workspace operations
  CREATE_WORKSPACE: 'workspace.create',
  GET_WORKSPACE: 'workspace.get',
  GET_WORKSPACE_BY_SLUG: 'workspace.getBySlug',
  UPDATE_WORKSPACE: 'workspace.update',
  DELETE_WORKSPACE: 'workspace.delete',
  LIST_WORKSPACES: 'workspace.list',

  // Member operations
  ADD_MEMBER: 'workspace.member.add',
  REMOVE_MEMBER: 'workspace.member.remove',
  UPDATE_MEMBER_ROLE: 'workspace.member.updateRole',
  GET_MEMBER: 'workspace.member.get',
  LIST_MEMBERS: 'workspace.member.list',
  UPDATE_MEMBER_STATUS: 'workspace.member.updateStatus',
  UPDATE_MEMBER_POSITION: 'workspace.member.updatePosition',

  // Invitation operations
  CREATE_INVITATION: 'workspace.invitation.create',
  ACCEPT_INVITATION: 'workspace.invitation.accept',
  DECLINE_INVITATION: 'workspace.invitation.decline',
  REVOKE_INVITATION: 'workspace.invitation.revoke',
  GET_INVITATION: 'workspace.invitation.get',
  LIST_INVITATIONS: 'workspace.invitation.list',

  // Office layout operations
  GENERATE_OFFICE: 'workspace.office.generate',
  GET_OFFICE_LAYOUT: 'workspace.office.get',
  UPDATE_OFFICE_LAYOUT: 'workspace.office.update',

  // Events
  WORKSPACE_CREATED: 'workspace.event.created',
  WORKSPACE_UPDATED: 'workspace.event.updated',
  WORKSPACE_DELETED: 'workspace.event.deleted',
  MEMBER_JOINED: 'workspace.event.member.joined',
  MEMBER_LEFT: 'workspace.event.member.left',
  MEMBER_STATUS_CHANGED: 'workspace.event.member.statusChanged',
  MEMBER_POSITION_CHANGED: 'workspace.event.member.positionChanged',
} as const;

// Task Service Patterns (future)
export const TASK_PATTERNS = {
  CREATE_TASK: 'task.create',
  GET_TASK: 'task.get',
  UPDATE_TASK: 'task.update',
  DELETE_TASK: 'task.delete',
  LIST_TASKS: 'task.list',
  ASSIGN_TASK: 'task.assign',
  UNASSIGN_TASK: 'task.unassign',

  // Events
  TASK_CREATED: 'task.event.created',
  TASK_UPDATED: 'task.event.updated',
  TASK_DELETED: 'task.event.deleted',
  TASK_ASSIGNED: 'task.event.assigned',
  TASK_COMPLETED: 'task.event.completed',
} as const;

// Type exports
export type AuthPattern = (typeof AUTH_PATTERNS)[keyof typeof AUTH_PATTERNS];
export type WorkspacePattern = (typeof WORKSPACE_PATTERNS)[keyof typeof WORKSPACE_PATTERNS];
export type TaskPattern = (typeof TASK_PATTERNS)[keyof typeof TASK_PATTERNS];
