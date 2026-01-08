/**
 * Game Types for 2D Virtual Office
 * 
 * Player-specific types for the Phaser game.
 * Office layout types are imported from @dev-pulse/shared-types.
 */

import type { Position } from '@dev-pulse/shared-types';

export type { Position };

// ============================================
// PLAYER TYPES
// ============================================

export type PlayerStatus = 'online' | 'available' | 'away' | 'busy' | 'offline' | 'dnd';
export type PlayerDirection = 'up' | 'down' | 'left' | 'right';

export interface PlayerData {
  id: string;
  name: string;
  email?: string;
  position: Position;
  direction?: PlayerDirection;
  status?: PlayerStatus;
  avatarColor?: string;
  workspaceId?: string;
}

// ============================================
// GAME EVENT TYPES
// ============================================

export interface GameEvents {
  'player:move': { position: Position; direction: string };
  'player:joined': PlayerData;
  'player:left': { id: string };
  'player:updated': Partial<PlayerData> & { id: string };
  'players:sync': PlayerData[];
}

// ============================================
// AVATAR COLORS
// ============================================

// Colors for avatars (assigned based on user id hash)
export const AVATAR_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Purple
  '#85C1E9', // Sky Blue
]

export function getAvatarColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
