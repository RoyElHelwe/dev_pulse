/**
 * Office Realtime Types
 * 
 * Types for real-time office state and events
 */

import { Position } from '../common';
import { RoomStatus } from './enums';
import { MeetingRoomBooking } from './booking';

// ============================================
// OFFICE STATE
// ============================================

/**
 * Current state of the office (real-time)
 */
export interface OfficeState {
  layoutId: string;
  occupiedDesks: Map<string, string> | Record<string, string>; // deskId -> userId
  roomStatuses: Map<string, RoomStatus> | Record<string, RoomStatus>;
  activeBookings: MeetingRoomBooking[];
  onlineUsers: string[];
}

/**
 * Serializable version of OfficeState for API responses
 */
export interface OfficeStateDto {
  layoutId: string;
  occupiedDesks: Record<string, string>;
  roomStatuses: Record<string, RoomStatus>;
  activeBookings: MeetingRoomBooking[];
  onlineUsers: string[];
}

// ============================================
// OFFICE EVENTS
// ============================================

/**
 * Types of office update events
 */
export type OfficeEventType =
  | 'desk-occupied'
  | 'desk-vacated'
  | 'room-status-changed'
  | 'booking-created'
  | 'booking-cancelled'
  | 'user-joined'
  | 'user-left'
  | 'user-moved';

/**
 * Office update event
 */
export interface OfficeUpdateEvent {
  type: OfficeEventType;
  payload: unknown;
  timestamp: number;
  userId?: string;
}

/**
 * Desk occupied event payload
 */
export interface DeskOccupiedPayload {
  deskId: string;
  userId: string;
  userName?: string;
}

/**
 * Desk vacated event payload
 */
export interface DeskVacatedPayload {
  deskId: string;
  userId: string;
}

/**
 * Room status changed event payload
 */
export interface RoomStatusChangedPayload {
  roomId: string;
  status: RoomStatus;
  occupants?: string[];
}

/**
 * User moved event payload
 */
export interface UserMovedPayload {
  userId: string;
  position: Position;
  facing?: string;
}

// ============================================
// EDITOR TYPES
// ============================================

/**
 * Editor tool types
 */
export type EditorTool =
  | 'select'
  | 'pan'
  | 'desk'
  | 'room'
  | 'decoration'
  | 'zone'
  | 'wall'
  | 'eraser';

/**
 * Editor action types
 */
export type EditorActionType =
  | 'ADD_ITEM'
  | 'REMOVE_ITEM'
  | 'MOVE_ITEM'
  | 'RESIZE_ITEM'
  | 'ROTATE_ITEM'
  | 'UPDATE_ITEM'
  | 'SELECT_ITEMS'
  | 'CLEAR_SELECTION'
  | 'UNDO'
  | 'REDO'
  | 'SET_ZOOM'
  | 'SET_PAN'
  | 'SET_TOOL';

/**
 * Editor action
 */
export interface EditorAction {
  type: EditorActionType;
  payload: unknown;
  timestamp: number;
}

/**
 * Editor state
 */
export interface EditorState {
  selectedItems: string[];
  tool: EditorTool;
  zoom: number;
  pan: Position;
  historyIndex: number;
}
