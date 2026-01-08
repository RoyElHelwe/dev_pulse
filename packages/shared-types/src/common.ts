/**
 * Common Types
 * 
 * Shared base types used across the application
 */

// ============================================
// BASIC GEOMETRIC TYPES
// ============================================

export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface Rectangle extends Position, Dimensions {}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ============================================
// COMMON ENUMS
// ============================================

export type Direction = 'north' | 'south' | 'east' | 'west';

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// USER RELATED
// ============================================

export interface UserBasic {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

export type MemberRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

export type MemberStatus = 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY';
