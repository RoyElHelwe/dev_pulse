// Office Generation Constants

import { ZoneType, RoomType, DecorationType, DeskType, Dimensions } from './types'

// ============================================
// ZONE COLORS (with transparency for overlay)
// ============================================

export const ZONE_COLORS: Record<ZoneType | string, string> = {
  // Department zones
  engineering: 'rgba(66, 133, 244, 0.15)',  // Blue
  design: 'rgba(156, 39, 176, 0.15)',       // Purple
  sales: 'rgba(76, 175, 80, 0.15)',         // Green
  marketing: 'rgba(255, 152, 0, 0.15)',     // Orange
  operations: 'rgba(255, 235, 59, 0.15)',   // Yellow
  leadership: 'rgba(244, 67, 54, 0.15)',    // Red
  product: 'rgba(0, 188, 212, 0.15)',       // Cyan
  hr: 'rgba(233, 30, 99, 0.15)',            // Pink
  finance: 'rgba(139, 195, 74, 0.15)',      // Light Green
  support: 'rgba(158, 158, 158, 0.15)',     // Gray
  custom: 'rgba(121, 85, 72, 0.15)',        // Brown
  
  // Special zones
  collaboration: 'rgba(103, 58, 183, 0.15)', // Deep Purple
  focus: 'rgba(96, 125, 139, 0.15)',         // Blue Gray
  social: 'rgba(255, 193, 7, 0.15)',         // Amber
  reception: 'rgba(0, 150, 136, 0.15)',      // Teal
}

// Solid colors for Phaser rendering (hex)
export const ZONE_COLORS_HEX: Record<ZoneType | string, number> = {
  engineering: 0x4285f4,
  design: 0x9c27b0,
  sales: 0x4caf50,
  marketing: 0xff9800,
  operations: 0xffeb3b,
  leadership: 0xf44336,
  product: 0x00bcd4,
  hr: 0xe91e63,
  finance: 0x8bc34a,
  support: 0x9e9e9e,
  custom: 0x795548,
  collaboration: 0x673ab7,
  focus: 0x607d8b,
  social: 0xffc107,
  reception: 0x009688,
}

// ============================================
// ROOM DEFAULTS
// ============================================

export const ROOM_DEFAULTS: Record<RoomType, { 
  color: number
  borderColor: number
  defaultCapacity: number
  defaultSize: Dimensions
  equipment: string[]
}> = {
  meeting: {
    color: 0xe8f5e9,
    borderColor: 0x4caf50,
    defaultCapacity: 8,
    defaultSize: { width: 250, height: 180 },
    equipment: ['projector', 'whiteboard', 'video-conference'],
  },
  'phone-booth': {
    color: 0xfce4ec,
    borderColor: 0xe91e63,
    defaultCapacity: 1,
    defaultSize: { width: 80, height: 80 },
    equipment: [],
  },
  focus: {
    color: 0xeceff1,
    borderColor: 0x607d8b,
    defaultCapacity: 2,
    defaultSize: { width: 120, height: 100 },
    equipment: ['whiteboard'],
  },
  conference: {
    color: 0xe3f2fd,
    borderColor: 0x2196f3,
    defaultCapacity: 20,
    defaultSize: { width: 400, height: 300 },
    equipment: ['projector', 'whiteboard', 'video-conference', 'microphone'],
  },
  break: {
    color: 0xfff3e0,
    borderColor: 0xff9800,
    defaultCapacity: 10,
    defaultSize: { width: 200, height: 150 },
    equipment: ['coffee-machine', 'fridge', 'microwave'],
  },
  private: {
    color: 0xf3e5f5,
    borderColor: 0x9c27b0,
    defaultCapacity: 2,
    defaultSize: { width: 150, height: 120 },
    equipment: [],
  },
}

// ============================================
// DESK DEFAULTS
// ============================================

export const DESK_DEFAULTS: Record<DeskType, {
  width: number
  height: number
  color: number
  topColor: number
}> = {
  standard: {
    width: 80,
    height: 50,
    color: 0x8b4513,
    topColor: 0xd2b48c,
  },
  standing: {
    width: 80,
    height: 40,
    color: 0x2d3748,
    topColor: 0x4a5568,
  },
  hotdesk: {
    width: 70,
    height: 45,
    color: 0x2563eb,
    topColor: 0x60a5fa,
  },
  executive: {
    width: 120,
    height: 70,
    color: 0x5d4037,
    topColor: 0x8d6e63,
  },
  'l-shaped': {
    width: 120,
    height: 120,
    color: 0x8b4513,
    topColor: 0xd2b48c,
  },
}

// ============================================
// DECORATION SIZES
// ============================================

export const DECORATION_SIZES: Record<DecorationType, Dimensions> = {
  'plant-small': { width: 24, height: 24 },
  'plant-medium': { width: 36, height: 36 },
  'plant-large': { width: 48, height: 48 },
  whiteboard: { width: 80, height: 50 },
  'coffee-machine': { width: 40, height: 40 },
  printer: { width: 50, height: 40 },
  bookshelf: { width: 60, height: 30 },
  artwork: { width: 60, height: 40 },
  divider: { width: 80, height: 10 },
  'bean-bag': { width: 50, height: 50 },
  couch: { width: 120, height: 50 },
  'game-table': { width: 100, height: 60 },
  'water-cooler': { width: 30, height: 30 },
  'reception-desk': { width: 150, height: 60 },
}

// ============================================
// DECORATION COLORS
// ============================================

export const DECORATION_COLORS: Record<DecorationType, number> = {
  'plant-small': 0x228b22,
  'plant-medium': 0x228b22,
  'plant-large': 0x228b22,
  whiteboard: 0xffffff,
  'coffee-machine': 0x5d4037,
  printer: 0x455a64,
  bookshelf: 0x8b4513,
  artwork: 0xe91e63,
  divider: 0x90a4ae,
  'bean-bag': 0xff5722,
  couch: 0x795548,
  'game-table': 0x4caf50,
  'water-cooler': 0x03a9f4,
  'reception-desk': 0x37474f,
}

// ============================================
// LAYOUT CONSTRAINTS
// ============================================

export const LAYOUT_CONSTRAINTS = {
  // Minimum distances
  MIN_DESK_SPACING: 64,
  MIN_PATHWAY_WIDTH: 96,
  MIN_WALL_THICKNESS: 32,
  
  // Size limits
  MIN_OFFICE_WIDTH: 640,
  MIN_OFFICE_HEIGHT: 480,
  MAX_OFFICE_WIDTH: 4800,
  MAX_OFFICE_HEIGHT: 3200,
  
  // Ratios
  AREA_PER_PERSON: 150,
  MIN_DESK_AREA_RATIO: 0.35,
  MAX_DESK_AREA_RATIO: 0.60,
  
  // Counts
  MAX_MEETING_ROOMS: 10,
  MAX_PHONE_BOOTHS: 15,
  MAX_FOCUS_ROOMS: 8,
}

// ============================================
// TEMPLATE CATEGORIES INFO
// ============================================

export const TEMPLATE_CATEGORY_INFO = {
  STARTUP: {
    name: 'Tech Startup',
    description: 'Open floor plan with collaborative clusters',
    icon: '🚀',
    minTeam: 5,
    maxTeam: 15,
  },
  CORPORATE: {
    name: 'Corporate Office',
    description: 'Structured layout with department zones',
    icon: '🏢',
    minTeam: 20,
    maxTeam: 50,
  },
  CREATIVE: {
    name: 'Creative Agency',
    description: 'Flexible, modular spaces for creativity',
    icon: '🎨',
    minTeam: 10,
    maxTeam: 25,
  },
  REMOTE_HUB: {
    name: 'Remote Hub',
    description: 'Hot desk system for flexible teams',
    icon: '🌐',
    minTeam: 5,
    maxTeam: 30,
  },
  ENTERPRISE: {
    name: 'Enterprise Floor',
    description: 'Large-scale multi-team organization',
    icon: '🏛️',
    minTeam: 50,
    maxTeam: 100,
  },
  HYBRID: {
    name: 'Hybrid Workspace',
    description: 'Mixed assigned and hot desks',
    icon: '🔄',
    minTeam: 15,
    maxTeam: 40,
  },
}

// ============================================
// CULTURE SETTINGS
// ============================================

export const CULTURE_SETTINGS = {
  startup: {
    name: 'Startup',
    description: 'Casual, open, collaborative',
    preferOpenPlan: true,
    deskDensity: 'medium',
    decorationStyle: 'modern',
    features: ['bean-bags', 'game-table', 'open-kitchen'],
  },
  corporate: {
    name: 'Corporate',
    description: 'Structured, formal, professional',
    preferOpenPlan: false,
    deskDensity: 'high',
    decorationStyle: 'professional',
    features: ['reception', 'conference-room', 'private-offices'],
  },
  creative: {
    name: 'Creative',
    description: 'Flexible, collaborative, inspiring',
    preferOpenPlan: true,
    deskDensity: 'low',
    decorationStyle: 'artistic',
    features: ['brainstorm-room', 'inspiration-wall', 'flexible-furniture'],
  },
  tech: {
    name: 'Tech',
    description: 'Modern, focused, efficient',
    preferOpenPlan: true,
    deskDensity: 'medium',
    decorationStyle: 'minimalist',
    features: ['standing-desks', 'monitor-arms', 'quiet-zones'],
  },
  consulting: {
    name: 'Consulting',
    description: 'Client-focused, professional',
    preferOpenPlan: false,
    deskDensity: 'medium',
    decorationStyle: 'professional',
    features: ['client-meeting-rooms', 'reception', 'library'],
  },
  agency: {
    name: 'Agency',
    description: 'Dynamic, creative, client-friendly',
    preferOpenPlan: true,
    deskDensity: 'medium',
    decorationStyle: 'modern',
    features: ['presentation-area', 'creative-studios', 'lounge'],
  },
}

// ============================================
// WORK STYLE ADJUSTMENTS
// ============================================

export const WORK_STYLE_ADJUSTMENTS = {
  'remote-first': {
    hotDeskRatio: 0.7,
    meetingRoomMultiplier: 0.8,
    socialAreaMultiplier: 1.5,
    focusRoomMultiplier: 0.5,
  },
  hybrid: {
    hotDeskRatio: 0.4,
    meetingRoomMultiplier: 1.2,
    socialAreaMultiplier: 1.2,
    focusRoomMultiplier: 1.0,
  },
  'in-office': {
    hotDeskRatio: 0.1,
    meetingRoomMultiplier: 1.0,
    socialAreaMultiplier: 0.8,
    focusRoomMultiplier: 1.2,
  },
}

// ============================================
// COLLABORATION ADJUSTMENTS
// ============================================

export const COLLABORATION_ADJUSTMENTS = {
  high: {
    meetingRoomMultiplier: 1.5,
    collaborationZones: true,
    deskClusterSize: 6,
    openPlanPreference: 0.8,
  },
  medium: {
    meetingRoomMultiplier: 1.0,
    collaborationZones: true,
    deskClusterSize: 4,
    openPlanPreference: 0.5,
  },
  low: {
    meetingRoomMultiplier: 0.7,
    collaborationZones: false,
    deskClusterSize: 2,
    openPlanPreference: 0.2,
  },
}
