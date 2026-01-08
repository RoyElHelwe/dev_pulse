// Template 1: Tech Startup (5-15 people)
// Professional open floor plan with collaborative clusters

import { OfficeTemplate, OfficeLayoutData } from '../types'

export const techStartupTemplate: OfficeTemplate = {
  id: 'tech-startup',
  name: 'Tech Startup',
  description: 'Modern open floor plan with collaborative areas, perfect for early-stage tech companies',
  category: 'STARTUP',
  minTeamSize: 5,
  maxTeamSize: 15,
  tags: ['open-plan', 'collaborative', 'agile', 'modern'],
  layout: createTechStartupLayout(),
}

function createTechStartupLayout(): OfficeLayoutData {
  // Grid system: 32px tiles, all measurements divisible by 32
  const TILE = 32
  const WALL = TILE // Wall thickness
  const DESK_W = 96  // 3 tiles wide
  const DESK_H = 64  // 2 tiles deep
  const DESK_GAP = 32 // 1 tile gap between desks
  const ROW_GAP = 96  // 3 tiles between rows (for chairs + walkway)
  const ROOM_WALL = 16 // Internal room walls

  const width = 1600  
  const height = 900 

  return {
    metadata: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      mode: 'TEMPLATE',
      teamSize: 12,
      templateId: 'tech-startup',
    },
    dimensions: { width, height },
    
    // Zones - clearly defined areas
    zones: [
      {
        id: 'zone-engineering',
        type: 'engineering',
        name: 'Engineering',
        bounds: { x: WALL + TILE, y: WALL + TILE, width: 380, height: 380 },
        color: 'rgba(66, 133, 244, 0.15)',
        departmentType: 'engineering',
        rules: {
          allowHotDesks: false,
          focusMode: true,
          allowInteractions: ['wave', 'message', 'knock'],
          notificationsEnabled: true,
        },
      },
      {
        id: 'zone-product',
        type: 'product',
        name: 'Product & Design',
        bounds: { x: WALL + TILE + 400, y: WALL + TILE, width: 360, height: 380 },
        color: 'rgba(156, 39, 176, 0.15)',
        departmentType: 'design',
        rules: {
          allowHotDesks: false,
          focusMode: false,
          allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'],
          notificationsEnabled: true,
        },
      },
      {
        id: 'zone-collaboration',
        type: 'collaboration',
        name: 'Collaboration Hub',
        bounds: { x: WALL + TILE, y: WALL + TILE + 420, width: 760, height: 300 },
        color: 'rgba(103, 58, 183, 0.15)',
        rules: {
          allowHotDesks: true,
          focusMode: false,
          allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'],
          notificationsEnabled: true,
        },
      },
    ],

    // Desks - properly spaced
    desks: [
      // Engineering - 2 rows of 3 desks (6 total)
      // Row 1 - facing south
      { id: 'desk-eng-1', position: { x: 40, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-2', position: { x: 64 + DESK_W + DESK_GAP, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-3', position: { x: 64 + (DESK_W + DESK_GAP) * 2, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standing', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      
      // Row 2 - facing north (96 + 64 desk + 96 row gap = 256)
      { id: 'desk-eng-4', position: { x: 64, y: 256 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-5', position: { x: 64 + DESK_W + DESK_GAP, y: 256 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-6', position: { x: 64 + (DESK_W + DESK_GAP) * 2, y: 256 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standing', zoneId: 'zone-engineering', facing: 'north', isHotDesk: false, status: 'available' },
      
      // Product & Design - 2 rows of 2 desks (4 total)
      // Row 1
      { id: 'desk-design-1', position: { x: 480, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-product', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-design-2', position: { x: 480 + DESK_W + DESK_GAP, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-product', facing: 'south', isHotDesk: false, status: 'available' },
      
      // Row 2
      { id: 'desk-design-3', position: { x: 480, y: 256 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-product', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-design-4', position: { x: 480 + DESK_W + DESK_GAP, y: 256 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-product', facing: 'north', isHotDesk: false, status: 'available' },
      
      // Hot desks in collaboration area - 3 desks
      { id: 'desk-hot-1', position: { x: 64, y: 544 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-collaboration', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-hot-2', position: { x: 64 + DESK_W + DESK_GAP * 2, y: 544 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-collaboration', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-hot-3', position: { x: 64 + (DESK_W + DESK_GAP * 2) * 2, y: 544 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-collaboration', facing: 'south', isHotDesk: true, status: 'available' },
    ],

    // Rooms - with proper walls and doors
    rooms: [
      // Meeting Room - top right (with walls)
      {
        id: 'meeting-main',
        name: 'Glass Room',
        type: 'meeting',
        bounds: { x: 864, y: WALL, width: 384, height: 256 },
        capacity: 8,
        equipment: ['projector', 'whiteboard', 'video-conference'],
        bookable: true,
        status: 'available',
        color: '#e8f5e9',
        borderColor: '#4caf50',
      },
     
      // Break Room - bottom right (larger)
      {
        id: 'break-room',
        name: 'Coffee & Lounge',
        type: 'break',
        bounds: { x: 864, y: 448, width: 384, height: 416 },
        capacity: 8,
        equipment: ['coffee-machine', 'fridge'],
        bookable: false,
        status: 'available',
        color: '#fff3e0',
        borderColor: '#ff9800',
      },
    ],

    // Decorations - properly spaced
    decorations: [
      // Plants at corners and strategic locations
      { id: 'plant-1', type: 'plant-large', position: { x: 48, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-2', type: 'plant-medium', position: { x: 416, y: 48 }, dimensions: { width: 36, height: 36 } },
      { id: 'plant-3', type: 'plant-large', position: { x: 768, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-4', type: 'plant-small', position: { x: 48, y: 800 }, dimensions: { width: 32, height: 32 } },
      { id: 'plant-5', type: 'plant-medium', position: { x: 768, y: 800 }, dimensions: { width: 36, height: 36 } },
      
      // Whiteboard for engineering (between desk rows)
      { id: 'whiteboard-1', type: 'whiteboard', position: { x: 64, y: 368 }, dimensions: { width: 160, height: 48 }, interactive: true, interactionRadius: 100 },
      
      // Bean bags in collaboration zone
      { id: 'bean-bag-1', type: 'bean-bag', position: { x: 480, y: 700 }, dimensions: { width: 64, height: 64 } },
      { id: 'bean-bag-2', type: 'bean-bag', position: { x: 576, y: 700 }, dimensions: { width: 64, height: 64 } },
      { id: 'bean-bag-3', type: 'bean-bag', position: { x: 672, y: 700 }, dimensions: { width: 64, height: 64 } },
      
      // Coffee machine in break room
      { id: 'coffee-1', type: 'coffeeMachine', position: { x: 896, y: 480 }, dimensions: { width: 48, height: 48 }, interactive: true, interactionRadius: 80 },
      
      // Couch in break room
      { id: 'couch-1', type: 'couch', position: { x: 896, y: 700 }, dimensions: { width: 160, height: 64 } },
      { id: 'couch-2', type: 'couch', position: { x: 1088, y: 550 }, dimensions: { width: 64, height: 160 }, rotation: 90 },
    ],

    // Walls - outer walls + room walls with doors
    walls: [
      // === OUTER WALLS ===
      // Top wall (with entrance door in middle)
      { id: 'wall-top-left', start: { x: 0, y: 0 }, end: { x: 576, y: 0 }, thickness: WALL },
      { id: 'wall-top-right', start: { x: 672, y: 0 }, end: { x: width, y: 0 }, thickness: WALL }, // Door gap: 576-672 (96px)
      // Bottom wall
      { id: 'wall-bottom', start: { x: 0, y: height - WALL }, end: { x: width, y: height - WALL }, thickness: WALL },
      // Left wall  
      { id: 'wall-left', start: { x: 0, y: 0 }, end: { x: 0, y: height }, thickness: WALL },
      // Right wall
      { id: 'wall-right', start: { x: width - WALL, y: 0 }, end: { x: width - WALL, y: height }, thickness: WALL },
      
      // === MEETING ROOM WALLS ===
      // Left wall of meeting room (with door)
      { id: 'meeting-wall-left-top', start: { x: 832, y: WALL }, end: { x: 832, y: 96 }, thickness: ROOM_WALL },
      { id: 'meeting-wall-left-bottom', start: { x: 832, y: 192 }, end: { x: 832, y: 256 }, thickness: ROOM_WALL }, // Door: 96-192
      // Bottom wall of meeting room
      { id: 'meeting-wall-bottom', start: { x: 832, y: 256 }, end: { x: width - WALL, y: 256 }, thickness: ROOM_WALL },
      
      // === PHONE BOOTH 1 WALLS ===
      { id: 'booth1-left', start: { x: 832, y: 288 }, end: { x: 832, y: 416 }, thickness: ROOM_WALL },
      { id: 'booth1-bottom-left', start: { x: 832, y: 416 }, end: { x: 896, y: 416 }, thickness: ROOM_WALL },
      { id: 'booth1-bottom-right', start: { x: 960, y: 416 }, end: { x: 992, y: 416 }, thickness: ROOM_WALL }, // Door: 896-960
      { id: 'booth1-right', start: { x: 992, y: 288 }, end: { x: 992, y: 416 }, thickness: ROOM_WALL },
      
      // === PHONE BOOTH 2 WALLS ===
      { id: 'booth2-left', start: { x: 992, y: 288 }, end: { x: 992, y: 416 }, thickness: ROOM_WALL },
      { id: 'booth2-bottom-left', start: { x: 992, y: 416 }, end: { x: 1056, y: 416 }, thickness: ROOM_WALL },
      { id: 'booth2-bottom-right', start: { x: 1120, y: 416 }, end: { x: 1152, y: 416 }, thickness: ROOM_WALL }, // Door: 1056-1120
      
      // === BREAK ROOM WALLS ===
      // Left wall (with door)
      { id: 'break-wall-left-top', start: { x: 832, y: 448 }, end: { x: 832, y: 576 }, thickness: ROOM_WALL },
      { id: 'break-wall-left-bottom', start: { x: 832, y: 672 }, end: { x: 832, y: height - WALL }, thickness: ROOM_WALL }, // Door: 576-672
      // Top wall of break room
      { id: 'break-wall-top', start: { x: 832, y: 448 }, end: { x: width - WALL, y: 448 }, thickness: ROOM_WALL },
    ],

    // Spawn points
    spawnPoints: [
      { id: 'spawn-default', position: { x: 450, y: 460 }, type: 'default' }, // At entrance
      { id: 'spawn-engineering', position: { x: 224, y: 192 }, type: 'department', departmentType: 'engineering' },
      { id: 'spawn-design', position: { x: 576, y: 192 }, type: 'department', departmentType: 'design' },
    ],

    // Pathways - main corridors
    pathways: [
      // Main horizontal corridor (between desk areas and collaboration)
      {
        id: 'corridor-main',
        points: [{ x: WALL, y: 420 }, { x: 800, y: 420 }],
        width: 96,
        isMainCorridor: true,
      },
      // Vertical corridor (between engineering and product zones)
      {
        id: 'corridor-vertical',
        points: [{ x: 440, y: WALL }, { x: 440, y: height - WALL }],
        width: 64,
        isMainCorridor: true,
      },
      // Access to rooms
      {
        id: 'corridor-rooms',
        points: [{ x: 800, y: WALL }, { x: 800, y: height - WALL }],
        width: 64,
        isMainCorridor: true,
      },
    ],
  }
}

export default techStartupTemplate
