// ============================================
// User Types
// ============================================

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  emailVerified: boolean
  twoFactorEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PublicUser {
  id: string
  email: string
  name: string | null
  image: string | null
  twoFactorEnabled?: boolean
}

export interface RegisterRequest {
  email: string
  password: string
  name?: string
  invitationToken?: string
}

export interface RegisterResponse {
  id: string
  email: string
  name: string | null
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  requires2FA: boolean
  userId?: string
  user?: PublicUser
}

export interface Verify2FARequest {
  userId: string
  token: string
}

export interface Verify2FAResponse {
  user: PublicUser
}

export interface RefreshTokenResponse {
  user: PublicUser
}

export interface Setup2FAResponse {
  secret: string
  qrCode: string
}

export interface SessionInfo {
  user: PublicUser
  session: {
    id: string
    expires: Date
  }
}

export interface UserSession {
  id: string
  ipAddress: string | null
  userAgent: string | null
  deviceInfo?: string
  createdAt: Date
  expiresAt: Date
  lastActivityAt: Date
  isCurrent: boolean
}

export interface ApiError {
  statusCode: number
  message: string
  error?: string
}

// ============================================
// Role Types
// ============================================

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER'

export interface RolePermissions {
  canAccessDashboard: boolean
  canAccessTeam: boolean
  canInviteMembers: boolean
  canAccessSettings: boolean
  canAccessWorkspace: boolean
  canManageWorkspace: boolean
}

// Role hierarchy: OWNER > ADMIN > MANAGER > MEMBER > VIEWER
export const ROLE_PERMISSIONS: Record<WorkspaceRole, RolePermissions> = {
  OWNER: {
    canAccessDashboard: true,
    canAccessTeam: true,
    canInviteMembers: true,
    canAccessSettings: true,
    canAccessWorkspace: true,
    canManageWorkspace: true,
  },
  ADMIN: {
    canAccessDashboard: true,
    canAccessTeam: true,
    canInviteMembers: true,
    canAccessSettings: true,
    canAccessWorkspace: true,
    canManageWorkspace: true,
  },
  MANAGER: {
    canAccessDashboard: false,
    canAccessTeam: true,
    canInviteMembers: true,
    canAccessSettings: true,
    canAccessWorkspace: true,
    canManageWorkspace: false,
  },
  MEMBER: {
    canAccessDashboard: false,
    canAccessTeam: true,
    canInviteMembers: false,
    canAccessSettings: true,
    canAccessWorkspace: true,
    canManageWorkspace: false,
  },
  VIEWER: {
    canAccessDashboard: false,
    canAccessTeam: true,
    canInviteMembers: false,
    canAccessSettings: true,
    canAccessWorkspace: true,
    canManageWorkspace: false,
  },
}

export function getRolePermissions(role: string): RolePermissions {
  return ROLE_PERMISSIONS[role as WorkspaceRole] || ROLE_PERMISSIONS.MEMBER
}
