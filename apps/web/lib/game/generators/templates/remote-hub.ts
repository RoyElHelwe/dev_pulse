// Template 4: Remote Hub (5-30 people)
// Professional hot desk layout with proper walls, doors, and calculated spacing

import { OfficeTemplate, OfficeLayoutData } from '../types'

export const remoteHubTemplate: OfficeTemplate = {
  id: 'remote-hub',
  name: 'Remote Hub',
  description: 'Hot desk system optimized for remote-first teams with video call booths, touchdown spaces, and social areas',
  category: 'REMOTE_HUB',
  minTeamSize: 5,
  maxTeamSize: 30,
  tags: ['remote-first', 'hot-desk', 'flexible', 'video-calls', 'social'],
  layout: createRemoteHubLayout(),
}

function createRemoteHubLayout(): OfficeLayoutData {
  // Professional grid system
  const TILE = 32
  const WALL = TILE
  const ROOM_WALL = 16
  const DESK_W = 96
  const DESK_H = 64
  const DESK_GAP = 32
  const DOOR_W = 96

  const width = 1408   // 44 tiles
  const height = 1024  // 32 tiles

  return {
    metadata: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      mode: 'TEMPLATE',
      teamSize: 20,
      templateId: 'remote-hub',
    },
    dimensions: { width, height },
    
    // Zones - Flexible, social-focused
    zones: [
      // Hot Desk Zone - Main area (left side)
      {
        id: 'zone-hotdesk-main',
        type: 'collaboration',
        name: 'Hot Desk Area',
        bounds: { x: WALL + TILE, y: WALL + TILE, width: 480, height: 352 },
        color: 'rgba(33, 150, 243, 0.15)',
        rules: {
          allowHotDesks: true,
          focusMode: false,
          allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'],
          notificationsEnabled: true,
        },
      },
      // Touchdown Zone - Quick work (center top)
      {
        id: 'zone-touchdown',
        type: 'collaboration',
        name: 'Touchdown Space',
        bounds: { x: 576, y: WALL + TILE, width: 288, height: 256 },
        color: 'rgba(0, 188, 212, 0.15)',
        rules: {
          allowHotDesks: true,
          focusMode: false,
          allowInteractions: ['wave', 'message'],
          notificationsEnabled: true,
          maxOccupancy: 8,
        },
      },
      // Video Call Zone (right side)
      {
        id: 'zone-video',
        type: 'focus',
        name: 'Video Call Area',
        bounds: { x: 928, y: WALL + TILE, width: 416, height: 384 },
        color: 'rgba(96, 125, 139, 0.15)',
        rules: {
          allowHotDesks: false,
          focusMode: true,
          allowInteractions: ['knock', 'urgent'],
          notificationsEnabled: false,
        },
      },
      // Social Hub (bottom left)
      {
        id: 'zone-social',
        type: 'social',
        name: 'Social Hub',
        bounds: { x: WALL + TILE, y: 480, width: 544, height: 416 },
        color: 'rgba(255, 193, 7, 0.15)',
        rules: {
          allowHotDesks: true,
          focusMode: false,
          allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'],
          notificationsEnabled: true,
        },
      },
      // Quiet Zone (bottom center)
      {
        id: 'zone-quiet',
        type: 'focus',
        name: 'Quiet Zone',
        bounds: { x: 640, y: 544, width: 288, height: 288 },
        color: 'rgba(158, 158, 158, 0.15)',
        rules: {
          allowHotDesks: true,
          focusMode: true,
          allowInteractions: ['urgent'],
          notificationsEnabled: false,
        },
      },
    ],

    // Desks - Mostly hot desks with calculated positions
    desks: [
      // Main Hot Desk Area - 12 hot desks (3 rows x 4)
      // Row 1 (y: 96)
      { id: 'desk-hot-1', position: { x: 64, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-hotdesk-main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-hot-2', position: { x: 192, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-hotdesk-main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-hot-3', position: { x: 320, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-hotdesk-main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-hot-4', position: { x: 448, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-hotdesk-main', facing: 'south', isHotDesk: true, status: 'available' },
      // Row 2 (y: 224)
      { id: 'desk-hot-5', position: { x: 64, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-hotdesk-main', facing: 'north', isHotDesk: true, status: 'available' },
      { id: 'desk-hot-6', position: { x: 192, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-hotdesk-main', facing: 'north', isHotDesk: true, status: 'available' },
      { id: 'desk-hot-7', position: { x: 320, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-hotdesk-main', facing: 'north', isHotDesk: true, status: 'available' },
      { id: 'desk-hot-8', position: { x: 448, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-hotdesk-main', facing: 'north', isHotDesk: true, status: 'available' },
      // Standing desk row (y: 352)
      { id: 'desk-stand-1', position: { x: 64, y: 352 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standing', zoneId: 'zone-hotdesk-main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-stand-2', position: { x: 192, y: 352 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standing', zoneId: 'zone-hotdesk-main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-stand-3', position: { x: 320, y: 352 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standing', zoneId: 'zone-hotdesk-main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-stand-4', position: { x: 448, y: 352 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standing', zoneId: 'zone-hotdesk-main', facing: 'south', isHotDesk: true, status: 'available' },
      
      // Touchdown space - 5 desks
      { id: 'desk-td-1', position: { x: 608, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-touchdown', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-td-2', position: { x: 736, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-touchdown', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-td-3', position: { x: 608, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-touchdown', facing: 'north', isHotDesk: true, status: 'available' },
      { id: 'desk-td-4', position: { x: 736, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-touchdown', facing: 'north', isHotDesk: true, status: 'available' },
      
      // Quiet Zone - Focus desks (6 desks, 2 rows x 3)
      { id: 'desk-quiet-1', position: { x: 672, y: 576 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-quiet', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-quiet-2', position: { x: 800, y: 576 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-quiet', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-quiet-3', position: { x: 672, y: 704 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-quiet', facing: 'north', isHotDesk: true, status: 'available' },
      { id: 'desk-quiet-4', position: { x: 800, y: 704 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-quiet', facing: 'north', isHotDesk: true, status: 'available' },
      
      // Social area cafe-style seating (3 desks)
      { id: 'desk-cafe-1', position: { x: 64, y: 512 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-social', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-cafe-2', position: { x: 192, y: 512 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-social', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-cafe-3', position: { x: 320, y: 512 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-social', facing: 'south', isHotDesk: true, status: 'available' },
    ],

    // Rooms - Focus on video call booths
    rooms: [
      // Video Call Booths (4 booths in a row)
      {
        id: 'video-booth-1',
        name: 'Video Booth 1',
        type: 'phone-booth',
        bounds: { x: 960, y: 64, width: 96, height: 96 },
        capacity: 1,
        equipment: ['webcam', 'ring-light', 'soundproofing'],
        bookable: true,
        status: 'available',
        color: '#e3f2fd',
        borderColor: '#2196f3',
      },
      {
        id: 'video-booth-2',
        name: 'Video Booth 2',
        type: 'phone-booth',
        bounds: { x: 1088, y: 64, width: 96, height: 96 },
        capacity: 1,
        equipment: ['webcam', 'ring-light', 'soundproofing'],
        bookable: true,
        status: 'available',
        color: '#e3f2fd',
        borderColor: '#2196f3',
      },
      {
        id: 'video-booth-3',
        name: 'Video Booth 3',
        type: 'phone-booth',
        bounds: { x: 1216, y: 64, width: 96, height: 96 },
        capacity: 1,
        equipment: ['webcam', 'ring-light', 'soundproofing'],
        bookable: true,
        status: 'available',
        color: '#e3f2fd',
        borderColor: '#2196f3',
      },
      {
        id: 'video-booth-4',
        name: 'Video Booth 4',
        type: 'phone-booth',
        bounds: { x: 960, y: 192, width: 96, height: 96 },
        capacity: 1,
        equipment: ['webcam', 'ring-light', 'soundproofing'],
        bookable: true,
        status: 'available',
        color: '#e3f2fd',
        borderColor: '#2196f3',
      },
      // Small Meeting Room for video calls
      {
        id: 'video-meeting',
        name: 'Video Meeting Room',
        type: 'meeting',
        bounds: { x: 1088, y: 192, width: 224, height: 160 },
        capacity: 4,
        equipment: ['large-display', 'webcam', 'video-conference', 'soundproofing'],
        bookable: true,
        status: 'available',
        color: '#e8f5e9',
        borderColor: '#4caf50',
      },
      // Town Hall Space (bottom right)
      {
        id: 'townhall',
        name: 'Town Hall',
        type: 'conference',
        bounds: { x: 992, y: 512, width: 352, height: 320 },
        capacity: 30,
        equipment: ['projector', 'microphone', 'video-conference', 'live-stream'],
        bookable: true,
        status: 'available',
        color: '#fff8e1',
        borderColor: '#ffc107',
      },
      // Cafe/Kitchen
      {
        id: 'cafe',
        name: 'Community Cafe',
        type: 'break',
        bounds: { x: 320, y: 640, width: 288, height: 256 },
        capacity: 20,
        equipment: ['coffeeMachine', 'espresso', 'fridge', 'snacks'],
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
      { id: 'plant-3', type: 'plant-large', position: { x: 896, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-4', type: 'plant-medium', position: { x: 48, y: 928 }, dimensions: { width: 36, height: 36 } },
      { id: 'plant-5', type: 'plant-medium', position: { x: 608, y: 928 }, dimensions: { width: 36, height: 36 } },
      { id: 'plant-6', type: 'plant-small', position: { x: 544, y: 416 }, dimensions: { width: 24, height: 24 } },
      
      // Lounge furniture in social area
      { id: 'couch-1', type: 'couch', position: { x: 64, y: 704 }, dimensions: { width: 128, height: 64 } },
      { id: 'couch-2', type: 'couch', position: { x: 64, y: 800 }, dimensions: { width: 128, height: 64 } },
      { id: 'couch-3', type: 'couch', position: { x: 224, y: 704 }, dimensions: { width: 128, height: 64 } },
      
      { id: 'bean-bag-1', type: 'bean-bag', position: { x: 64, y: 896 }, dimensions: { width: 64, height: 64 } },
      { id: 'bean-bag-2', type: 'bean-bag', position: { x: 144, y: 896 }, dimensions: { width: 64, height: 64 } },
      { id: 'bean-bag-3', type: 'bean-bag', position: { x: 224, y: 896 }, dimensions: { width: 64, height: 64 } },
      
      // Cafe area
      { id: 'coffee-1', type: 'coffeeMachine', position: { x: 352, y: 672 }, dimensions: { width: 48, height: 48 }, interactive: true, interactionRadius: 80 },
      { id: 'water-1', type: 'waterCooler', position: { x: 416, y: 672 }, dimensions: { width: 32, height: 32 }, interactive: true, interactionRadius: 60 },
      
      // Whiteboards
      { id: 'whiteboard-1', type: 'whiteboard', position: { x: 576, y: 352 }, dimensions: { width: 128, height: 48 }, interactive: true, interactionRadius: 100 },
      
      // Game table
      { id: 'game-table-1', type: 'game-table', position: { x: 480, y: 768 }, dimensions: { width: 128, height: 96 }, interactive: true, interactionRadius: 80 },
    ],

    // Walls - with proper doors
    walls: [
      // === OUTER WALLS (with entrance door bottom) ===
      { id: 'wall-top', start: { x: 0, y: 0 }, end: { x: width, y: 0 }, thickness: WALL },
      { id: 'wall-left', start: { x: 0, y: 0 }, end: { x: 0, y: height }, thickness: WALL },
      { id: 'wall-right', start: { x: width - WALL, y: 0 }, end: { x: width - WALL, y: height }, thickness: WALL },
      // Bottom wall with entrance door (center)
      { id: 'wall-bottom-left', start: { x: 0, y: height - WALL }, end: { x: 608, y: height - WALL }, thickness: WALL },
      { id: 'wall-bottom-right', start: { x: 704, y: height - WALL }, end: { x: width, y: height - WALL }, thickness: WALL }, // Door: 608-704
      
      // === VIDEO CALL ZONE SEPARATOR (with door) ===
      { id: 'video-left-top', start: { x: 928, y: WALL }, end: { x: 928, y: 192 }, thickness: ROOM_WALL },
      { id: 'video-left-bottom', start: { x: 928, y: 288 }, end: { x: 928, y: 448 }, thickness: ROOM_WALL }, // Door: 192-288
      
      // === VIDEO BOOTH 1 WALLS ===
      { id: 'vb1-bottom-left', start: { x: 928, y: 160 }, end: { x: 976, y: 160 }, thickness: ROOM_WALL },
      { id: 'vb1-bottom-right', start: { x: 1040, y: 160 }, end: { x: 1056, y: 160 }, thickness: ROOM_WALL }, // Door: 976-1040
      { id: 'vb1-right', start: { x: 1056, y: WALL }, end: { x: 1056, y: 160 }, thickness: ROOM_WALL },
      
      // === VIDEO BOOTH 2 WALLS ===
      { id: 'vb2-bottom-left', start: { x: 1056, y: 160 }, end: { x: 1104, y: 160 }, thickness: ROOM_WALL },
      { id: 'vb2-bottom-right', start: { x: 1168, y: 160 }, end: { x: 1184, y: 160 }, thickness: ROOM_WALL }, // Door: 1104-1168
      { id: 'vb2-right', start: { x: 1184, y: WALL }, end: { x: 1184, y: 160 }, thickness: ROOM_WALL },
      
      // === VIDEO BOOTH 3 WALLS ===
      { id: 'vb3-bottom-left', start: { x: 1184, y: 160 }, end: { x: 1232, y: 160 }, thickness: ROOM_WALL },
      { id: 'vb3-bottom-right', start: { x: 1296, y: 160 }, end: { x: 1312, y: 160 }, thickness: ROOM_WALL }, // Door: 1232-1296
      { id: 'vb3-right', start: { x: 1312, y: WALL }, end: { x: 1312, y: 160 }, thickness: ROOM_WALL },
      
      // === VIDEO BOOTH 4 WALLS ===
      { id: 'vb4-bottom-left', start: { x: 928, y: 288 }, end: { x: 976, y: 288 }, thickness: ROOM_WALL },
      { id: 'vb4-bottom-right', start: { x: 1040, y: 288 }, end: { x: 1056, y: 288 }, thickness: ROOM_WALL }, // Door: 976-1040
      { id: 'vb4-right', start: { x: 1056, y: 192 }, end: { x: 1056, y: 288 }, thickness: ROOM_WALL },
      { id: 'vb4-top', start: { x: 928, y: 192 }, end: { x: 1056, y: 192 }, thickness: ROOM_WALL },
      
      // === VIDEO MEETING ROOM WALLS ===
      { id: 'vmr-top', start: { x: 1056, y: 192 }, end: { x: 1312, y: 192 }, thickness: ROOM_WALL },
      { id: 'vmr-left-top', start: { x: 1056, y: 192 }, end: { x: 1056, y: 256 }, thickness: ROOM_WALL },
      { id: 'vmr-left-bottom', start: { x: 1056, y: 320 }, end: { x: 1056, y: 352 }, thickness: ROOM_WALL }, // Door: 256-320
      { id: 'vmr-bottom', start: { x: 1056, y: 352 }, end: { x: 1312, y: 352 }, thickness: ROOM_WALL },
      { id: 'vmr-right', start: { x: 1312, y: 192 }, end: { x: 1312, y: 352 }, thickness: ROOM_WALL },
      
      // === TOWN HALL WALLS ===
      { id: 'th-top', start: { x: 960, y: 512 }, end: { x: width - WALL, y: 512 }, thickness: ROOM_WALL },
      { id: 'th-left-top', start: { x: 960, y: 512 }, end: { x: 960, y: 640 }, thickness: ROOM_WALL },
      { id: 'th-left-bottom', start: { x: 960, y: 736 }, end: { x: 960, y: height - WALL }, thickness: ROOM_WALL }, // Door: 640-736
      
      // === CAFE WALLS ===
      { id: 'cafe-top', start: { x: 288, y: 640 }, end: { x: 640, y: 640 }, thickness: ROOM_WALL },
      { id: 'cafe-left-top', start: { x: 288, y: 640 }, end: { x: 288, y: 736 }, thickness: ROOM_WALL },
      { id: 'cafe-left-bottom', start: { x: 288, y: 832 }, end: { x: 288, y: height - WALL }, thickness: ROOM_WALL }, // Door: 736-832
      { id: 'cafe-right', start: { x: 640, y: 640 }, end: { x: 640, y: height - WALL }, thickness: ROOM_WALL },
      
      // === QUIET ZONE WALLS ===
      { id: 'quiet-top', start: { x: 640, y: 512 }, end: { x: 928, y: 512 }, thickness: ROOM_WALL },
      { id: 'quiet-left-top', start: { x: 640, y: 512 }, end: { x: 640, y: 608 }, thickness: ROOM_WALL },
      { id: 'quiet-left-bottom', start: { x: 640, y: 704 }, end: { x: 640, y: 864 }, thickness: ROOM_WALL }, // Door: 608-704
      { id: 'quiet-bottom', start: { x: 640, y: 864 }, end: { x: 928, y: 864 }, thickness: ROOM_WALL },
      { id: 'quiet-right', start: { x: 928, y: 512 }, end: { x: 928, y: 864 }, thickness: ROOM_WALL },
    ],

    // Spawn points
    spawnPoints: [
      { id: 'spawn-default', position: { x: 656, y: 960 }, type: 'default' }, // At entrance
      { id: 'spawn-social', position: { x: 288, y: 720 }, type: 'default' },
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
      // Vertical corridor
      {
        id: 'corridor-v',
        points: [{ x: 576, y: WALL }, { x: 576, y: height - WALL }],
        width: 64,
        isMainCorridor: true,
      },
      // Access to video area
      {
        id: 'corridor-video',
        points: [{ x: 896, y: 96 }, { x: 896, y: 480 }],
        width: 64,
        isMainCorridor: false,
      },
    ],
  }
}

export default remoteHubTemplate
