// ============================================
// User Roles & Permissions
// ============================================

export const WORKSPACE_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const

export const ROLE_HIERARCHY = {
  owner: 5,
  admin: 4,
  manager: 3,
  member: 2,
  viewer: 1,
} as const

// ============================================
// Task Constants
// ============================================

export const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  DONE: 'done',
} as const

export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const

// ============================================
// Sprint Constants
// ============================================

export const SPRINT_STATUS = {
  PLANNED: 'planned',
  ACTIVE: 'active',
  COMPLETED: 'completed',
} as const

export const DEFAULT_SPRINT_DURATION_DAYS = 14

// ============================================
// Auth Constants
// ============================================

export const OTP_LENGTH = 6
export const OTP_EXPIRY_MINUTES = 10
export const RECOVERY_CODES_COUNT = 10
export const SESSION_MAX_AGE_DAYS = 7
export const PASSWORD_MIN_LENGTH = 8

export const OAUTH_PROVIDERS = {
  GOOGLE: 'google',
  GITHUB: 'github',
  FORTYTWO: '42',
} as const

// ============================================
// Rate Limiting
// ============================================

export const RATE_LIMITS = {
  LOGIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
  },
  REGISTER: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts
  },
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests
  },
  WEBSOCKET: {
    windowMs: 1000, // 1 second
    max: 10, // 10 messages
  },
} as const

// ============================================
// Game/Office Constants
// ============================================

export const PLAYER_STATUS = {
  ACTIVE: 'active',
  AWAY: 'away',
  BUSY: 'busy',
} as const

export const OFFICE_OBJECT_TYPES = {
  DESK: 'desk',
  WHITEBOARD: 'whiteboard',
  MEETING_ROOM: 'meeting_room',
  BREAK_ROOM: 'break_room',
  DECORATION: 'decoration',
} as const

export const DEFAULT_OFFICE_SIZE = {
  WIDTH: 1600,
  HEIGHT: 1200,
} as const

export const PLAYER_SPEED = 200 // pixels per second
export const PROXIMITY_DISTANCE = 100 // pixels

// ============================================
// WebSocket Events
// ============================================

export const WS_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  
  // Workspace
  JOIN_WORKSPACE: 'join:workspace',
  LEAVE_WORKSPACE: 'leave:workspace',
  
  // Tasks
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',
  
  // Chat
  MESSAGE_SENT: 'message:sent',
  MESSAGE_RECEIVED: 'message:received',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  
  // Game/Office
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  PLAYER_MOVED: 'player:moved',
  PLAYER_STATUS_CHANGED: 'player:status_changed',
  
  // Notifications
  NOTIFICATION: 'notification',
} as const

// ============================================
// Error Codes
// ============================================

export const ERROR_CODES = {
  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INVALID_OTP: 'INVALID_OTP',
  INVALID_2FA: 'INVALID_2FA',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

// ============================================
// Email Templates
// ============================================

export const EMAIL_SUBJECTS = {
  VERIFY_EMAIL: 'Verify your email address',
  RESET_PASSWORD: 'Reset your password',
  INVITE_WORKSPACE: 'You have been invited to join a workspace',
  WELCOME: 'Welcome to ft_transcendence!',
  TASK_ASSIGNED: 'You have been assigned a new task',
} as const

// ============================================
// Pagination
// ============================================

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

// ============================================
// File Upload
// ============================================

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
] as const
