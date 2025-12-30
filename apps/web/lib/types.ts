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
