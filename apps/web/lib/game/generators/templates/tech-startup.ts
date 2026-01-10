// Template 1: Tech Startup (5-15 people)
// Professional open floor plan with collaborative clusters
// Features: 13 desks (6 eng, 4 design, 3 hot), 2 focus pods, meeting room, break area
// Includes: Interactive whiteboards, coffee station, lounge seating, multiple plants

import { OfficeTemplate, OfficeLayoutData } from '../types'

export const techStartupTemplate: OfficeTemplate = {
  id: 'tech-startup',
  name: 'Tech Startup',
  description: 'Modern open floor plan with collaborative areas, focus pods, and flexible seating - perfect for early-stage tech companies',
  category: 'STARTUP',
  minTeamSize: 5,
  maxTeamSize: 15,
  tags: ['open-plan', 'collaborative', 'agile', 'modern', 'flexible'],
  layout: createTechStartupLayout(),
}

function createTechStartupLayout(): OfficeLayoutData {
  // === GRID SYSTEM ===
  // All measurements align to 32px tiles for clean, consistent spacing
  const TILE = 32
  const WALL = TILE // Wall thickness (32px)
  const DESK_W = 96  // 3 tiles wide - standard desk width
  const DESK_H = 64  // 2 tiles deep - standard desk depth
  const DESK_GAP = 32 // 1 tile gap between desks
  const ROW_GAP = 96  // 3 tiles between rows (for chairs + walkway)
  const ROOM_WALL = 16 // Internal room walls (thinner than outer walls)

  // === OFFICE DIMENSIONS ===
  const width = 1600   // Total office width
  const height = 900   // Total office height 

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

    // Desks - properly spaced with variety for ergonomics
    desks: [
      // === ENGINEERING ZONE - 2 rows of 3 desks (6 total) ===
      // Row 1 - facing south for natural light
      { id: 'desk-eng-1', position: { x: 64, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-2', position: { x: 64 + DESK_W + DESK_GAP, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-3', position: { x: 64 + (DESK_W + DESK_GAP) * 2, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standing', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      
      // Row 2 - facing north (96 + 64 desk + 96 row gap = 256)
      { id: 'desk-eng-4', position: { x: 64, y: 256 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-5', position: { x: 64 + DESK_W + DESK_GAP, y: 256 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-6', position: { x: 64 + (DESK_W + DESK_GAP) * 2, y: 256 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standing', zoneId: 'zone-engineering', facing: 'north', isHotDesk: false, status: 'available' },
      
      // === PRODUCT & DESIGN ZONE - 2 rows of 2 desks (4 total) ===
      // Row 1 - wider desks for design work
      { id: 'desk-design-1', position: { x: 480, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-product', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-design-2', position: { x: 480 + DESK_W + DESK_GAP, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-product', facing: 'south', isHotDesk: false, status: 'available' },
      
      // Row 2
      { id: 'desk-design-3', position: { x: 480, y: 256 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-product', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-design-4', position: { x: 480 + DESK_W + DESK_GAP, y: 256 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-product', facing: 'north', isHotDesk: false, status: 'available' },
      
      // === COLLABORATION ZONE - Hot desks (3 total) ===
      // Flexible seating for visitors, temporary work, or overflow
      { id: 'desk-hot-1', position: { x: 64, y: 544 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-collaboration', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-hot-2', position: { x: 64 + DESK_W + DESK_GAP * 2, y: 544 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-collaboration', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-hot-3', position: { x: 64 + (DESK_W + DESK_GAP * 2) * 2, y: 544 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'hotdesk', zoneId: 'zone-collaboration', facing: 'south', isHotDesk: true, status: 'available' },
    ],

    // Rooms - with proper walls and doors
    rooms: [
      // Meeting Room - top right (with walls) - Fixed position to align with walls
      {
        id: 'meeting-main',
        name: 'Glass Room',
        type: 'meeting',
        bounds: { x: 848, y: WALL, width: 736, height: 240 },
        capacity: 8,
        equipment: ['projector', 'whiteboard', 'video-conference'],
        bookable: true,
        status: 'available',
        color: '#e8f5e9',
        borderColor: '#4caf50',
      },
      
      // Phone Booth 1 - for private calls
      {
        id: 'phone-booth-1',
        name: 'Focus Pod 1',
        type: 'phone-booth',
        bounds: { x: 848, y: 288, width: 144, height: 128 },
        capacity: 1,
        equipment: ['phone', 'desk-light'],
        bookable: true,
        status: 'available',
        color: '#e3f2fd',
        borderColor: '#2196f3',
      },
      
      // Phone Booth 2 - for private calls
      {
        id: 'phone-booth-2',
        name: 'Focus Pod 2',
        type: 'phone-booth',
        bounds: { x: 1008, y: 288, width: 144, height: 128 },
        capacity: 1,
        equipment: ['phone', 'desk-light'],
        bookable: true,
        status: 'available',
        color: '#e3f2fd',
        borderColor: '#2196f3',
      },
     
      // Break Room - bottom right (larger)
      {
        id: 'break-room',
        name: 'Coffee & Lounge',
        type: 'break',
        bounds: { x: 848, y: 458, width: 736, height: 440 },
        capacity: 8,
        equipment: ['coffee-machine', 'fridge', 'microwave'],
        bookable: false,
        status: 'available',
        color: '#fff3e0',
        borderColor: '#ff9800',
      },
    ],

    // Decorations - properly spaced with enhanced variety
    decorations: [
      // === PLANTS - Strategic placement for aesthetics ===
      { id: 'plant-1', type: 'plant-large', position: { x: 48, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-2', type: 'plant-medium', position: { x: 416, y: 48 }, dimensions: { width: 36, height: 36 } },
      { id: 'plant-3', type: 'plant-large', position: { x: 768, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-4', type: 'plant-small', position: { x: 48, y: 800 }, dimensions: { width: 32, height: 32 } },
      { id: 'plant-5', type: 'plant-medium', position: { x: 768, y: 800 }, dimensions: { width: 36, height: 36 } },
      { id: 'plant-6', type: 'plant-small', position: { x: 400, y: 192 }, dimensions: { width: 32, height: 32 } },
      { id: 'plant-7', type: 'plant-medium', position: { x: 800, y: 192 }, dimensions: { width: 36, height: 36 } },
      
      // === COLLABORATIVE TOOLS ===
      // Whiteboards for brainstorming (positioned between desk rows)
      { id: 'whiteboard-1', type: 'whiteboard', position: { x: 250, y: 400 }, dimensions: { width: 160, height: 48 }, interactive: true, interactionRadius: 100 },
      { id: 'whiteboard-2', type: 'whiteboard', position: { x: 596, y: 400 }, dimensions: { width: 160, height: 48 }, interactive: true, interactionRadius: 100 },
      
      // Standing collaboration table
      { id: 'collab-table-1', type: 'meeting-table', position: { x: 320, y: 600 }, dimensions: { width: 96, height: 64 } },
      
      // === LOUNGE FURNITURE ===
      // Bean bags in collaboration zone
      { id: 'bean-bag-1', type: 'bean-bag', position: { x: 480, y: 700 }, dimensions: { width: 64, height: 64 } },
      { id: 'bean-bag-2', type: 'bean-bag', position: { x: 576, y: 700 }, dimensions: { width: 64, height: 64 } },
      { id: 'bean-bag-3', type: 'bean-bag', position: { x: 672, y: 700 }, dimensions: { width: 64, height: 64 } },
      
      // === BREAK ROOM AMENITIES ===
      // Coffee station
      { id: 'coffee-1', type: 'coffeeMachine', position: { x: 896, y: 480 }, dimensions: { width: 48, height: 48 }, interactive: true, interactionRadius: 80 },
      { id: 'water-cooler', type: 'water-cooler', position: { x: 1088, y: 480 }, dimensions: { width: 32, height: 48 }, interactive: true, interactionRadius: 80 },
      
      // Lounge seating
      { id: 'couch-1', type: 'couch', position: { x: 896, y: 700 }, dimensions: { width: 160, height: 64 } },
      { id: 'couch-2', type: 'couch', position: { x: 1120, y: 550 }, dimensions: { width: 64, height: 160 }, rotation: 90 },
      { id: 'armchair-1', type: 'armchair', position: { x: 1088, y: 700 }, dimensions: { width: 64, height: 64 } },
      
      // Coffee table
      { id: 'coffee-table', type: 'coffee-table', position: { x: 960, y: 640 }, dimensions: { width: 96, height: 64 } },
      
      // === OFFICE EQUIPMENT ===
      // Bookshelf for resources
      { id: 'bookshelf-1', type: 'bookshelf', position: { x: 800, y: 64 }, dimensions: { width: 96, height: 48 } },
      
      // Filing cabinet
      { id: 'filing-cabinet', type: 'filing-cabinet', position: { x: 800, y: 320 }, dimensions: { width: 48, height: 48 } },
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
