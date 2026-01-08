/**
 * Office Entity Types
 * 
 * Individual entities within an office layout:
 * zones, desks, rooms, decorations, walls, spawn points, pathways
 */

import { Position, Dimensions, Rectangle, Direction } from '../common';
import {
  ZoneType,
  DepartmentType,
  DeskType,
  DeskStatus,
  RoomType,
  RoomStatus,
  DecorationType,
  InteractionType,
  SpawnPointType,
} from './enums';

// ============================================
// ZONE TYPES
// ============================================

/**
 * Zone within the office (department area, collaboration space, etc.)
 */
export interface ZoneData {
  id: string;
  type: ZoneType;
  name: string;
  bounds: Rectangle;
  color: string;
  departmentType?: DepartmentType;
  rules: ZoneRules;
}

/**
 * Rules that apply within a zone
 */
export interface ZoneRules {
  allowHotDesks: boolean;
  focusMode: boolean;
  allowInteractions: InteractionType[];
  notificationsEnabled: boolean;
  maxOccupancy?: number;
}

// ============================================
// DESK TYPES
// ============================================

/**
 * Desk entity within the office
 */
export interface DeskData {
  id: string;
  position: Position;
  dimensions: Dimensions;
  type: DeskType;
  zoneId: string;
  facing: Direction;

  // Assignment
  isHotDesk: boolean;
  assignedUserId?: string;
  assignedUserName?: string;
  /** @deprecated Use assignedUserName instead */
  assignedTo?: string;

  // Status
  status: DeskStatus;
  equipment?: string[];

  // Visual
  color?: string;
}

// ============================================
// ROOM TYPES
// ============================================

/**
 * Room entity (meeting room, phone booth, etc.)
 */
export interface RoomData {
  id: string;
  name: string;
  type: RoomType;
  bounds: Rectangle;
  capacity: number;

  // Features
  equipment: string[];
  bookable: boolean;
  requiresApproval?: boolean;

  // Status
  status: RoomStatus;
  currentOccupants?: string[];

  // Visual
  color?: string;
  borderColor?: string;
}

// ============================================
// DECORATION TYPES
// ============================================

/**
 * Decorative element in the office
 */
export interface DecorationData {
  id: string;
  type: DecorationType;
  position: Position;
  dimensions: Dimensions;
  rotation?: number;
  interactive?: boolean;
  interactionRadius?: number;
}

// ============================================
// WALL TYPES
// ============================================

/**
 * Wall segment in the office
 */
export interface WallData {
  id: string;
  start: Position;
  end: Position;
  thickness: number;
  hasWindow?: boolean;
  hasDoor?: boolean;
  doorPosition?: Position;
}

// ============================================
// SPAWN POINT TYPES
// ============================================

/**
 * Spawn point where users appear when entering
 */
export interface SpawnPoint {
  id: string;
  position: Position;
  type: SpawnPointType;
  departmentType?: DepartmentType;
}

// ============================================
// PATHWAY TYPES
// ============================================

/**
 * Pathway/corridor in the office
 */
export interface PathwayData {
  id: string;
  points: Position[];
  width: number;
  isMainCorridor: boolean;
}
