// Template 3: Creative Agency (10-25 people)
// Professional flexible layout with proper walls, doors, and calculated spacing

import { OfficeTemplate, OfficeLayoutData } from '../types'

export const creativeAgencyTemplate: OfficeTemplate = {
  id: 'creative-agency',
  name: 'Creative Agency',
  description: 'Flexible, modular spaces designed for creativity with inspiration walls, brainstorm areas, and collaborative pods',
  category: 'CREATIVE',
  minTeamSize: 10,
  maxTeamSize: 25,
  tags: ['creative', 'flexible', 'collaborative', 'modular', 'design'],
  layout: createCreativeAgencyLayout(),
}

function createCreativeAgencyLayout(): OfficeLayoutData {
  // Professional grid system
  const TILE = 32
  const WALL = TILE
  const ROOM_WALL = 16
  const DESK_W = 96
  const DESK_H = 64
  const DESK_GAP = 32
  const DOOR_W = 96

  const width = 1600  // 50 tiles
  const height = 1120 // 35 tiles

  return {
    metadata: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      mode: 'TEMPLATE',
      teamSize: 18,
      templateId: 'creative-agency',
    },
    dimensions: { width, height },
    
    // Zones - Creative areas
    zones: [
      // Design Studio - Main creative area (left side)
      {
        id: 'zone-design',
        type: 'design',
        name: 'Design Studio',
        bounds: { x: WALL + TILE, y: WALL + TILE, width: 480, height: 384 },
        color: 'rgba(156, 39, 176, 0.15)',
        departmentType: 'design',
        rules: {
          allowHotDesks: false,
          focusMode: false,
          allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'],
          notificationsEnabled: true,
        },
      },
      // Content Creation Area (center top)
      {
        id: 'zone-content',
        type: 'marketing',
        name: 'Content Hub',
        bounds: { x: 576, y: WALL + TILE, width: 416, height: 288 },
        color: 'rgba(255, 152, 0, 0.15)',
        departmentType: 'marketing',
        rules: {
          allowHotDesks: true,
          focusMode: false,
          allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'],
          notificationsEnabled: true,
        },
      },
      // Brainstorm Zone (right side top)
      {
        id: 'zone-brainstorm',
        type: 'collaboration',
        name: 'Brainstorm Zone',
        bounds: { x: 1056, y: WALL + TILE, width: 480, height: 352 },
        color: 'rgba(103, 58, 183, 0.15)',
        rules: {
          allowHotDesks: true,
          focusMode: false,
          allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'],
          notificationsEnabled: true,
        },
      },
      // Account Management (left bottom)
      {
        id: 'zone-accounts',
        type: 'sales',
        name: 'Account Management',
        bounds: { x: WALL + TILE, y: 512, width: 352, height: 288 },
        color: 'rgba(76, 175, 80, 0.15)',
        departmentType: 'sales',
        rules: {
          allowHotDesks: false,
          focusMode: false,
          allowInteractions: ['wave', 'call', 'message', 'invite'],
          notificationsEnabled: true,
        },
      },
      // Creative Lounge (center bottom)
      {
        id: 'zone-lounge',
        type: 'social',
        name: 'Creative Lounge',
        bounds: { x: 448, y: 544, width: 416, height: 352 },
        color: 'rgba(255, 193, 7, 0.15)',
        rules: {
          allowHotDesks: true,
          focusMode: false,
          allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'],
          notificationsEnabled: true,
        },
      },
    ],

    // Desks - Properly calculated positions
    desks: [
      // Design Studio - 8 desks (2 rows x 4)
      // Row 1 (y: 96)
      { id: 'desk-design-1', position: { x: 64, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-design', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-design-2', position: { x: 192, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-design', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-design-3', position: { x: 320, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-design', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-design-4', position: { x: 448, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standing', zoneId: 'zone-design', facing: 'south', isHotDesk: false, status: 'available' },
      // Row 2 (y: 224)
      { id: 'desk-design-5', position: { x: 64, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-design', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-design-6', position: { x: 192, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standing', zoneId: 'zone-design', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-design-7', position: { x: 320, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-design', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-design-8', position: { x: 448, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-design', facing: 'north', isHotDesk: false, status: 'available' },
      
      // Content Hub - 5 desks
      { id: 'desk-content-1', position: { x: 608, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-content', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-content-2', position: { x: 736, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-content', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-content-3', position: { x: 864, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-content', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-content-hot-1', position: { x: 608, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-content', facing: 'north', isHotDesk: true, status: 'available' },
      { id: 'desk-content-hot-2', position: { x: 736, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-content', facing: 'north', isHotDesk: true, status: 'available' },
      
      // Brainstorm Zone - 3 hot desks
      { id: 'desk-brain-hot-1', position: { x: 1088, y: 128 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-brainstorm', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-brain-hot-2', position: { x: 1216, y: 128 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-brainstorm', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-brain-hot-3', position: { x: 1344, y: 128 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-brainstorm', facing: 'south', isHotDesk: true, status: 'available' },
      
      // Account Management - 4 desks (2 rows x 2)
      { id: 'desk-account-1', position: { x: 64, y: 576 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-accounts', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-account-2', position: { x: 192, y: 576 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-accounts', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-account-3', position: { x: 64, y: 704 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-accounts', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-account-4', position: { x: 192, y: 704 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-accounts', facing: 'north', isHotDesk: false, status: 'available' },
      
      // Lounge hot desks
      { id: 'desk-lounge-hot-1', position: { x: 480, y: 576 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-lounge', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-lounge-hot-2', position: { x: 608, y: 576 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-lounge', facing: 'south', isHotDesk: true, status: 'available' },
    ],

    // Rooms - Properly enclosed with walls
    rooms: [
      // Brainstorm Room
      {
        id: 'brainstorm-room',
        name: 'Brainstorm Room',
        type: 'meeting',
        bounds: { x: 1088, y: 256, width: 256, height: 192 },
        capacity: 10,
        equipment: ['whiteboard', 'post-its', 'projector'],
        bookable: true,
        status: 'available',
        color: '#f3e5f5',
        borderColor: '#9c27b0',
      },
      // Client Meeting Room
      {
        id: 'client-room',
        name: 'Client Room',
        type: 'meeting',
        bounds: { x: 1376, y: 64, width: 192, height: 160 },
        capacity: 8,
        equipment: ['projector', 'video-conference', 'whiteboard'],
        bookable: true,
        status: 'available',
        color: '#e8f5e9',
        borderColor: '#4caf50',
      },
      // Recording/Video Booth
      {
        id: 'recording-booth',
        name: 'Recording Studio',
        type: 'focus',
        bounds: { x: 1376, y: 256, width: 160, height: 128 },
        capacity: 2,
        equipment: ['microphone', 'camera', 'green-screen'],
        bookable: true,
        status: 'available',
        color: '#ffebee',
        borderColor: '#f44336',
      },
      // Phone booths
      {
        id: 'phone-booth-1',
        name: 'Phone Booth 1',
        type: 'phone-booth',
        bounds: { x: 576, y: 352, width: 96, height: 96 },
        capacity: 1,
        equipment: [],
        bookable: false,
        status: 'available',
        color: '#fce4ec',
        borderColor: '#e91e63',
      },
      {
        id: 'phone-booth-2',
        name: 'Phone Booth 2',
        type: 'phone-booth',
        bounds: { x: 704, y: 352, width: 96, height: 96 },
        capacity: 1,
        equipment: [],
        bookable: false,
        status: 'available',
        color: '#fce4ec',
        borderColor: '#e91e63',
      },
      // Kitchen/Break area
      {
        id: 'kitchen',
        name: 'Kitchen Island',
        type: 'break',
        bounds: { x: 928, y: 544, width: 288, height: 256 },
        capacity: 12,
        equipment: ['coffeeMachine', 'fridge', 'microwave', 'kitchen-island'],
        bookable: false,
        status: 'available',
        color: '#fff3e0',
        borderColor: '#ff9800',
      },
    ],

    // Decorations
    decorations: [
      // Plants
      { id: 'plant-1', type: 'plant-large', position: { x: 48, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-2', type: 'plant-large', position: { x: 544, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-3', type: 'plant-large', position: { x: 1024, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-4', type: 'plant-medium', position: { x: 48, y: 1024 }, dimensions: { width: 36, height: 36 } },
      { id: 'plant-5', type: 'plant-medium', position: { x: 416, y: 1024 }, dimensions: { width: 36, height: 36 } },
      { id: 'plant-6', type: 'plant-small', position: { x: 320, y: 352 }, dimensions: { width: 24, height: 24 } },
      
      // Inspiration whiteboards
      { id: 'whiteboard-1', type: 'whiteboard', position: { x: 64, y: 352 }, dimensions: { width: 160, height: 48 }, interactive: true, interactionRadius: 100 },
      { id: 'whiteboard-2', type: 'whiteboard', position: { x: 256, y: 352 }, dimensions: { width: 160, height: 48 }, interactive: true, interactionRadius: 100 },
      { id: 'whiteboard-3', type: 'whiteboard', position: { x: 1088, y: 64 }, dimensions: { width: 128, height: 48 }, interactive: true, interactionRadius: 100 },
      
      // Artwork displays
      { id: 'artwork-1', type: 'artwork', position: { x: 608, y: 48 }, dimensions: { width: 64, height: 48 } },
      { id: 'artwork-2', type: 'artwork', position: { x: 736, y: 48 }, dimensions: { width: 64, height: 48 } },
      { id: 'artwork-3', type: 'artwork', position: { x: 864, y: 48 }, dimensions: { width: 64, height: 48 } },
      
      // Lounge furniture
      { id: 'couch-1', type: 'couch', position: { x: 480, y: 704 }, dimensions: { width: 128, height: 64 } },
      { id: 'couch-2', type: 'couch', position: { x: 640, y: 704 }, dimensions: { width: 128, height: 64 } },
      { id: 'bean-bag-1', type: 'bean-bag', position: { x: 480, y: 816 }, dimensions: { width: 64, height: 64 } },
      { id: 'bean-bag-2', type: 'bean-bag', position: { x: 560, y: 816 }, dimensions: { width: 64, height: 64 } },
      { id: 'bean-bag-3', type: 'bean-bag', position: { x: 640, y: 816 }, dimensions: { width: 64, height: 64 } },
      { id: 'bean-bag-4', type: 'bean-bag', position: { x: 720, y: 816 }, dimensions: { width: 64, height: 64 } },
      
      // Kitchen area
      { id: 'coffee-1', type: 'coffeeMachine', position: { x: 960, y: 576 }, dimensions: { width: 48, height: 48 }, interactive: true, interactionRadius: 80 },
      
      // Game table
      { id: 'game-table-1', type: 'game-table', position: { x: 1248, y: 576 }, dimensions: { width: 128, height: 96 }, interactive: true, interactionRadius: 80 },
      
      // Bookshelf
      { id: 'bookshelf-1', type: 'bookshelf', position: { x: 448, y: 352 }, dimensions: { width: 64, height: 32 } },
    ],

    // Walls - with proper doors
    walls: [
      // === OUTER WALLS (with entrance door bottom-right) ===
      { id: 'wall-top', start: { x: 0, y: 0 }, end: { x: width, y: 0 }, thickness: WALL },
      { id: 'wall-left', start: { x: 0, y: 0 }, end: { x: 0, y: height }, thickness: WALL },
      { id: 'wall-right', start: { x: width - WALL, y: 0 }, end: { x: width - WALL, y: height }, thickness: WALL },
      // Bottom wall with entrance door
      { id: 'wall-bottom-left', start: { x: 0, y: height - WALL }, end: { x: 1376, y: height - WALL }, thickness: WALL },
      { id: 'wall-bottom-right', start: { x: 1472, y: height - WALL }, end: { x: width, y: height - WALL }, thickness: WALL }, // Door: 1376-1472
      
      // === DESIGN STUDIO SEPARATOR (partial wall with door) ===
      { id: 'design-right-top', start: { x: 576, y: WALL }, end: { x: 576, y: 192 }, thickness: ROOM_WALL },
      { id: 'design-right-bottom', start: { x: 576, y: 288 }, end: { x: 576, y: 448 }, thickness: ROOM_WALL }, // Door: 192-288
      
      // === BRAINSTORM ZONE LEFT WALL (with door) ===
      { id: 'brain-left-top', start: { x: 1056, y: WALL }, end: { x: 1056, y: 160 }, thickness: ROOM_WALL },
      { id: 'brain-left-bottom', start: { x: 1056, y: 256 }, end: { x: 1056, y: 480 }, thickness: ROOM_WALL }, // Door: 160-256
      
      // === CLIENT ROOM WALLS ===
      { id: 'client-left-top', start: { x: 1344, y: WALL }, end: { x: 1344, y: 96 }, thickness: ROOM_WALL },
      { id: 'client-left-bottom', start: { x: 1344, y: 192 }, end: { x: 1344, y: 256 }, thickness: ROOM_WALL }, // Door: 96-192
      { id: 'client-bottom', start: { x: 1344, y: 256 }, end: { x: width - WALL, y: 256 }, thickness: ROOM_WALL },
      
      // === RECORDING BOOTH WALLS ===
      { id: 'record-top', start: { x: 1344, y: 256 }, end: { x: width - WALL, y: 256 }, thickness: ROOM_WALL },
      { id: 'record-left-top', start: { x: 1344, y: 256 }, end: { x: 1344, y: 304 }, thickness: ROOM_WALL },
      { id: 'record-left-bottom', start: { x: 1344, y: 368 }, end: { x: 1344, y: 416 }, thickness: ROOM_WALL }, // Door: 304-368
      { id: 'record-bottom', start: { x: 1344, y: 416 }, end: { x: width - WALL, y: 416 }, thickness: ROOM_WALL },
      
      // === BRAINSTORM ROOM WALLS ===
      { id: 'broom-top', start: { x: 1056, y: 256 }, end: { x: 1344, y: 256 }, thickness: ROOM_WALL },
      { id: 'broom-left-top', start: { x: 1056, y: 256 }, end: { x: 1056, y: 320 }, thickness: ROOM_WALL },
      { id: 'broom-left-bottom', start: { x: 1056, y: 416 }, end: { x: 1056, y: 480 }, thickness: ROOM_WALL }, // Door: 320-416
      { id: 'broom-bottom', start: { x: 1056, y: 480 }, end: { x: 1344, y: 480 }, thickness: ROOM_WALL },
      { id: 'broom-right', start: { x: 1344, y: 416 }, end: { x: 1344, y: 480 }, thickness: ROOM_WALL },
      
      // === PHONE BOOTH 1 WALLS ===
      { id: 'booth1-top', start: { x: 544, y: 352 }, end: { x: 704, y: 352 }, thickness: ROOM_WALL },
      { id: 'booth1-bottom-left', start: { x: 544, y: 448 }, end: { x: 592, y: 448 }, thickness: ROOM_WALL },
      { id: 'booth1-bottom-right', start: { x: 656, y: 448 }, end: { x: 704, y: 448 }, thickness: ROOM_WALL }, // Door: 592-656
      { id: 'booth1-left', start: { x: 544, y: 352 }, end: { x: 544, y: 448 }, thickness: ROOM_WALL },
      { id: 'booth1-mid', start: { x: 704, y: 352 }, end: { x: 704, y: 448 }, thickness: ROOM_WALL },
      
      // === PHONE BOOTH 2 WALLS ===
      { id: 'booth2-top', start: { x: 704, y: 352 }, end: { x: 832, y: 352 }, thickness: ROOM_WALL },
      { id: 'booth2-bottom-left', start: { x: 704, y: 448 }, end: { x: 752, y: 448 }, thickness: ROOM_WALL },
      { id: 'booth2-bottom-right', start: { x: 816, y: 448 }, end: { x: 832, y: 448 }, thickness: ROOM_WALL }, // Door: 752-816
      { id: 'booth2-right', start: { x: 832, y: 352 }, end: { x: 832, y: 448 }, thickness: ROOM_WALL },
      
      // === KITCHEN WALLS ===
      { id: 'kitchen-top', start: { x: 896, y: 544 }, end: { x: 1248, y: 544 }, thickness: ROOM_WALL },
      { id: 'kitchen-left-top', start: { x: 896, y: 544 }, end: { x: 896, y: 640 }, thickness: ROOM_WALL },
      { id: 'kitchen-left-bottom', start: { x: 896, y: 736 }, end: { x: 896, y: 832 }, thickness: ROOM_WALL }, // Door: 640-736
      { id: 'kitchen-bottom', start: { x: 896, y: 832 }, end: { x: 1248, y: 832 }, thickness: ROOM_WALL },
      { id: 'kitchen-right', start: { x: 1248, y: 544 }, end: { x: 1248, y: 832 }, thickness: ROOM_WALL },
      
      // === ACCOUNT AREA SEPARATOR ===
      { id: 'account-right-top', start: { x: 416, y: 512 }, end: { x: 416, y: 640 }, thickness: ROOM_WALL },
      { id: 'account-right-bottom', start: { x: 416, y: 736 }, end: { x: 416, y: height - WALL }, thickness: ROOM_WALL }, // Door: 640-736
    ],

    // Spawn points
    spawnPoints: [
      { id: 'spawn-default', position: { x: 1424, y: 1056 }, type: 'default' }, // At entrance
      { id: 'spawn-design', position: { x: 288, y: 192 }, type: 'department', departmentType: 'design' },
      { id: 'spawn-content', position: { x: 736, y: 192 }, type: 'department', departmentType: 'marketing' },
      { id: 'spawn-accounts', position: { x: 192, y: 640 }, type: 'department', departmentType: 'sales' },
    ],

    // Pathways
    pathways: [
      // Main horizontal corridor
      {
        id: 'corridor-main',
        points: [{ x: WALL, y: 480 }, { x: width - WALL, y: 480 }],
        width: 96,
        isMainCorridor: true,
      },
      // Vertical pathway (center)
      {
        id: 'corridor-v',
        points: [{ x: 544, y: WALL }, { x: 544, y: height - WALL }],
        width: 64,
        isMainCorridor: true,
      },
      // Access to brainstorm area
      {
        id: 'corridor-brainstorm',
        points: [{ x: 1024, y: 96 }, { x: 1024, y: 480 }],
        width: 64,
        isMainCorridor: false,
      },
    ],
  }
}

export default creativeAgencyTemplate
