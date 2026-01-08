/**
 * Office Enums
 * 
 * All enumeration types for office layouts
 * Synced with Prisma schema enums
 */

// ============================================
// GENERATION ENUMS
// ============================================

/**
 * How the office layout was generated
 * @prisma GenerationMode
 */
export type GenerationMode = 'AI_AUTO' | 'TEMPLATE' | 'MANUAL' | 'HYBRID';

/**
 * Template categories for pre-built layouts
 * @prisma TemplateCategory
 */
export type TemplateCategory = 
  | 'STARTUP' 
  | 'CORPORATE' 
  | 'CREATIVE' 
  | 'REMOTE_HUB' 
  | 'ENTERPRISE' 
  | 'HYBRID';

// ============================================
// ORGANIZATION ENUMS
// ============================================

/**
 * Department types within an organization
 */
export type DepartmentType =
  | 'engineering'
  | 'design'
  | 'sales'
  | 'marketing'
  | 'operations'
  | 'leadership'
  | 'product'
  | 'hr'
  | 'finance'
  | 'support'
  | 'custom';

/**
 * Work style preferences
 */
export type WorkStyle = 'remote-first' | 'hybrid' | 'in-office';

/**
 * Team collaboration level
 */
export type CollaborationLevel = 'high' | 'medium' | 'low';

/**
 * Office culture type
 */
export type OfficeCulture = 
  | 'startup' 
  | 'corporate' 
  | 'creative' 
  | 'tech' 
  | 'consulting' 
  | 'agency';

// ============================================
// DESK ENUMS
// ============================================

/**
 * Types of desks available
 */
export type DeskType = 
  | 'standard' 
  | 'standing' 
  | 'hotdesk' 
  | 'hot' 
  | 'executive' 
  | 'l-shaped';

/**
 * Current status of a desk
 */
export type DeskStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

// ============================================
// ROOM ENUMS
// ============================================

/**
 * Types of rooms in the office
 */
export type RoomType = 
  | 'meeting' 
  | 'phone-booth' 
  | 'phone' 
  | 'focus' 
  | 'conference' 
  | 'break' 
  | 'private' 
  | 'huddle';

/**
 * Current status of a room
 */
export type RoomStatus = 'available' | 'in-use' | 'reserved' | 'maintenance';

// ============================================
// ZONE ENUMS
// ============================================

/**
 * Zone types - combines department types with functional areas
 */
export type ZoneType = DepartmentType | 'collaboration' | 'focus' | 'social' | 'reception';

// ============================================
// DECORATION ENUMS
// ============================================

/**
 * Types of decorative items in the office
 */
export type DecorationType =
  | 'plant'
  | 'plant-small'
  | 'plant-medium'
  | 'plant-large'
  | 'whiteboard'
  | 'coffee-machine'
  | 'coffeeMachine'
  | 'printer'
  | 'bookshelf'
  | 'artwork'
  | 'divider'
  | 'bean-bag'
  | 'couch'
  | 'game-table'
  | 'water-cooler'
  | 'reception-desk'
  | 'lamp'
  | 'fridge'
  | 'conference-table'
  | 'lounge-chair'
  | 'coffee-table'
  | 'projector'
  | 'tv-screen'
  | 'filing-cabinet';

// ============================================
// INTERACTION ENUMS
// ============================================

/**
 * Types of interactions users can have in zones
 */
export type InteractionType =
  | 'wave'
  | 'call'
  | 'message'
  | 'invite'
  | 'knock'
  | 'urgent'
  | 'screen-share';

// ============================================
// SPAWN POINT ENUMS
// ============================================

/**
 * Types of spawn points
 */
export type SpawnPointType = 'default' | 'department' | 'visitor';
