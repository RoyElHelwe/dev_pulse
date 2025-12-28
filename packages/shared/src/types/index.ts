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

export interface Identity {
  id: string
  userId: string
  provider: 'email' | 'google' | 'github' | '42'
  providerAccountId: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: Date
}

export interface Session {
  id: string
  userId: string
  token: string
  expiresAt: Date
  ipAddress?: string
  userAgent?: string
  deviceName?: string
  createdAt: Date
}

export interface TwoFactorSecret {
  id: string
  userId: string
  secret: string
  recoveryCodes: string[]
  createdAt: Date
}

// ============================================
// Workspace Types
// ============================================

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'

export interface Workspace {
  id: string
  name: string
  ownerId: string
  officeLayout?: Record<string, any>
  settings?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  joinedAt: Date
}

export interface Invite {
  id: string
  workspaceId: string
  email: string
  role: WorkspaceRole
  token: string
  invitedBy: string
  expiresAt: Date
  acceptedAt?: Date
  createdAt: Date
}

// ============================================
// Task Types
// ============================================

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  description?: string
  workspaceId: string
  assigneeId?: string
  creatorId: string
  status: TaskStatus
  priority: TaskPriority
  tags: string[]
  deadline?: Date
  sprintId?: string
  createdAt: Date
  updatedAt: Date
}

export interface Sprint {
  id: string
  workspaceId: string
  name: string
  goal?: string
  startDate: Date
  endDate: Date
  status: 'planned' | 'active' | 'completed'
  createdAt: Date
}

export interface Comment {
  id: string
  taskId: string
  userId: string
  text: string
  createdAt: Date
  updatedAt: Date
}

// ============================================
// Chat Types
// ============================================

export interface Message {
  id: string
  workspaceId: string
  senderId: string
  recipientId?: string // null for team chat
  text: string
  timestamp: Date
}

export interface Channel {
  id: string
  workspaceId: string
  name: string
  type: 'team' | 'direct'
  memberIds: string[]
  createdAt: Date
}

// ============================================
// Game/Office Types
// ============================================

export interface PlayerPosition {
  userId: string
  workspaceId: string
  x: number
  y: number
  direction: 'up' | 'down' | 'left' | 'right'
  status: 'active' | 'away' | 'busy'
  currentTask?: string
  lastUpdate: Date
}

export interface OfficeLayout {
  id: string
  workspaceId: string
  width: number
  height: number
  objects: OfficeObject[]
  createdAt: Date
}

export interface OfficeObject {
  id: string
  type: 'desk' | 'whiteboard' | 'meeting_room' | 'break_room' | 'decoration'
  x: number
  y: number
  width: number
  height: number
  ownerId?: string
  metadata?: Record<string, any>
}

// ============================================
// Audit Log Types
// ============================================

export interface AuditLog {
  id: string
  userId: string
  workspaceId?: string
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, any>
  ipAddress?: string
  timestamp: Date
}

// ============================================
// Notification Types
// ============================================

export type NotificationType = 'email' | 'push' | 'in_app'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  read: boolean
  metadata?: Record<string, any>
  createdAt: Date
}
