// Template 2: Corporate Office (20-50 people)
// Professional structured layout with department zones, private offices, formal meeting rooms

import { OfficeTemplate, OfficeLayoutData } from '../types'

export const corporateOfficeTemplate: OfficeTemplate = {
  id: 'corporate-office',
  name: 'Corporate Office',
  description: 'Structured layout with department zones, executive offices, and formal meeting rooms',
  category: 'CORPORATE',
  minTeamSize: 20,
  maxTeamSize: 50,
  tags: ['structured', 'professional', 'departments', 'formal'],
  layout: createCorporateOfficeLayout(),
}

function createCorporateOfficeLayout(): OfficeLayoutData {
  // Professional grid system
  const TILE = 32
  const WALL = TILE
  const ROOM_WALL = 16
  const DESK_W = 96
  const DESK_H = 64
  const DESK_GAP = 32
  const EXEC_DESK_W = 128
  const EXEC_DESK_H = 80
  const CORRIDOR_W = 128
  const DOOR_W = 96

  const width = 2048  // 64 tiles
  const height = 1408 // 44 tiles

  // Main layout divisions
  const LEFT_SECTION_END = 640    // Departments end
  const CENTER_SECTION_END = 1280  // Center corridor end
  const RIGHT_SECTION_START = 1344 // Rooms/Executive start

  return {
    metadata: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      mode: 'TEMPLATE',
      teamSize: 35,
      templateId: 'corporate-office',
    },
    dimensions: { width, height },
    
    // Zones - Department areas
    zones: [
      // Engineering - Top Left
      {
        id: 'zone-engineering',
        type: 'engineering',
        name: 'Engineering',
        bounds: { x: WALL + TILE, y: WALL + TILE, width: 576, height: 416 },
        color: 'rgba(66, 133, 244, 0.15)',
        departmentType: 'engineering',
        rules: {
          allowHotDesks: false,
          focusMode: true,
          allowInteractions: ['wave', 'message', 'knock'],
          notificationsEnabled: true,
        },
      },
      // Sales - Top Center
      {
        id: 'zone-sales',
        type: 'sales',
        name: 'Sales',
        bounds: { x: 704, y: WALL + TILE, width: 512, height: 416 },
        color: 'rgba(76, 175, 80, 0.15)',
        departmentType: 'sales',
        rules: {
          allowHotDesks: false,
          focusMode: false,
          allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'],
          notificationsEnabled: true,
        },
      },
      // Marketing - Bottom Left
      {
        id: 'zone-marketing',
        type: 'marketing',
        name: 'Marketing',
        bounds: { x: WALL + TILE, y: 544, width: 576, height: 384 },
        color: 'rgba(255, 152, 0, 0.15)',
        departmentType: 'marketing',
        rules: {
          allowHotDesks: false,
          focusMode: false,
          allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'],
          notificationsEnabled: true,
        },
      },
      // Operations - Bottom Center
      {
        id: 'zone-operations',
        type: 'operations',
        name: 'Operations',
        bounds: { x: 704, y: 544, width: 512, height: 384 },
        color: 'rgba(255, 235, 59, 0.15)',
        departmentType: 'operations',
        rules: {
          allowHotDesks: false,
          focusMode: false,
          allowInteractions: ['wave', 'call', 'message', 'invite'],
          notificationsEnabled: true,
        },
      },
      // Executive Wing - Right Top
      {
        id: 'zone-leadership',
        type: 'leadership',
        name: 'Executive Wing',
        bounds: { x: RIGHT_SECTION_START, y: WALL + TILE, width: 640, height: 480 },
        color: 'rgba(156, 39, 176, 0.15)',
        departmentType: 'leadership',
        rules: {
          allowHotDesks: false,
          focusMode: true,
          allowInteractions: ['knock', 'message', 'urgent'],
          notificationsEnabled: true,
        },
      },
      // Reception - Near entrance
      {
        id: 'zone-reception',
        type: 'reception',
        name: 'Reception',
        bounds: { x: RIGHT_SECTION_START, y: 1024, width: 320, height: 320 },
        color: 'rgba(0, 150, 136, 0.15)',
        rules: {
          allowHotDesks: false,
          focusMode: false,
          allowInteractions: ['wave', 'call', 'message'],
          notificationsEnabled: true,
        },
      },
    ],

    // Desks - properly calculated
    desks: [
      // Engineering - 12 desks (3 rows x 4 desks)
      // Row 1 (y: 96)
      { id: 'desk-eng-1', position: { x: 64, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-2', position: { x: 192, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-3', position: { x: 320, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-4', position: { x: 448, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standing', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      // Row 2 (y: 224)
      { id: 'desk-eng-5', position: { x: 64, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-6', position: { x: 192, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-7', position: { x: 320, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-8', position: { x: 448, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standing', zoneId: 'zone-engineering', facing: 'north', isHotDesk: false, status: 'available' },
      // Row 3 (y: 352)
      { id: 'desk-eng-9', position: { x: 64, y: 352 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-10', position: { x: 192, y: 352 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-11', position: { x: 320, y: 352 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-eng-12', position: { x: 448, y: 352 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standing', zoneId: 'zone-engineering', facing: 'south', isHotDesk: false, status: 'available' },
      
      // Sales - 10 desks (3 rows: 4+4+2)
      { id: 'desk-sales-1', position: { x: 736, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-sales', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-sales-2', position: { x: 864, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-sales', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-sales-3', position: { x: 992, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-sales', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-sales-4', position: { x: 1120, y: 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-sales', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-sales-5', position: { x: 736, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-sales', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-sales-6', position: { x: 864, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-sales', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-sales-7', position: { x: 992, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-sales', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-sales-8', position: { x: 1120, y: 224 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-sales', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-sales-9', position: { x: 736, y: 352 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-sales', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-sales-10', position: { x: 864, y: 352 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-sales', facing: 'south', isHotDesk: false, status: 'available' },
      
      // Marketing - 6 desks (2 rows x 3)
      { id: 'desk-mkt-1', position: { x: 64, y: 608 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-marketing', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-mkt-2', position: { x: 192, y: 608 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-marketing', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-mkt-3', position: { x: 320, y: 608 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-marketing', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-mkt-4', position: { x: 64, y: 736 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-marketing', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-mkt-5', position: { x: 192, y: 736 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-marketing', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-mkt-6', position: { x: 320, y: 736 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-marketing', facing: 'north', isHotDesk: false, status: 'available' },
      
      // Operations - 6 desks (2 rows x 3)
      { id: 'desk-ops-1', position: { x: 736, y: 608 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-operations', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-ops-2', position: { x: 864, y: 608 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-operations', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-ops-3', position: { x: 992, y: 608 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-operations', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-ops-4', position: { x: 736, y: 736 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-operations', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-ops-5', position: { x: 864, y: 736 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-operations', facing: 'north', isHotDesk: false, status: 'available' },
      { id: 'desk-ops-6', position: { x: 992, y: 736 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard', zoneId: 'zone-operations', facing: 'north', isHotDesk: false, status: 'available' },
      
      // Executive desks - 4 larger desks in private offices
      { id: 'desk-exec-1', position: { x: 1408, y: 96 }, dimensions: { width: EXEC_DESK_W, height: EXEC_DESK_H }, type: 'executive', zoneId: 'zone-leadership', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-exec-2', position: { x: 1632, y: 96 }, dimensions: { width: EXEC_DESK_W, height: EXEC_DESK_H }, type: 'executive', zoneId: 'zone-leadership', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-exec-3', position: { x: 1408, y: 288 }, dimensions: { width: EXEC_DESK_W, height: EXEC_DESK_H }, type: 'executive', zoneId: 'zone-leadership', facing: 'south', isHotDesk: false, status: 'available' },
      { id: 'desk-exec-4', position: { x: 1632, y: 288 }, dimensions: { width: EXEC_DESK_W, height: EXEC_DESK_H }, type: 'executive', zoneId: 'zone-leadership', facing: 'south', isHotDesk: false, status: 'available' },
      
      // Reception desk
      { id: 'desk-reception', position: { x: 1408, y: 1088 }, dimensions: { width: 160, height: 64 }, type: 'standard', zoneId: 'zone-reception', facing: 'south', isHotDesk: false, status: 'available' },
    ],

    // Rooms - with calculated positions
    rooms: [
      // Large Conference Room (bottom right)
      {
        id: 'conference-main',
        name: 'Main Conference',
        type: 'conference',
        bounds: { x: 1696, y: 576, width: 320, height: 256 },
        capacity: 20,
        equipment: ['projector', 'whiteboard', 'video-conference', 'microphone'],
        bookable: true,
        status: 'available',
        color: '#e3f2fd',
        borderColor: '#2196f3',
      },
      // Meeting Room A
      {
        id: 'meeting-a',
        name: 'Meeting Room A',
        type: 'meeting',
        bounds: { x: 1696, y: 864, width: 192, height: 160 },
        capacity: 8,
        equipment: ['projector', 'whiteboard', 'video-conference'],
        bookable: true,
        status: 'available',
        color: '#e8f5e9',
        borderColor: '#4caf50',
      },
      // Meeting Room B
      {
        id: 'meeting-b',
        name: 'Meeting Room B',
        type: 'meeting',
        bounds: { x: 1696, y: 1056, width: 192, height: 160 },
        capacity: 6,
        equipment: ['whiteboard', 'video-conference'],
        bookable: true,
        status: 'available',
        color: '#e8f5e9',
        borderColor: '#4caf50',
      },
      // Meeting Room C
      {
        id: 'meeting-c',
        name: 'Meeting Room C',
        type: 'meeting',
        bounds: { x: 1696, y: 1248, width: 192, height: 128 },
        capacity: 4,
        equipment: ['whiteboard'],
        bookable: true,
        status: 'available',
        color: '#e8f5e9',
        borderColor: '#4caf50',
      },
      // Phone booths (in center corridor area)
      {
        id: 'phone-booth-1',
        name: 'Phone Booth 1',
        type: 'phone-booth',
        bounds: { x: 1248, y: 576, width: 96, height: 96 },
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
        bounds: { x: 1248, y: 704, width: 96, height: 96 },
        capacity: 1,
        equipment: [],
        bookable: false,
        status: 'available',
        color: '#fce4ec',
        borderColor: '#e91e63',
      },
      {
        id: 'phone-booth-3',
        name: 'Phone Booth 3',
        type: 'phone-booth',
        bounds: { x: 1248, y: 832, width: 96, height: 96 },
        capacity: 1,
        equipment: [],
        bookable: false,
        status: 'available',
        color: '#fce4ec',
        borderColor: '#e91e63',
      },
      // Break Room
      {
        id: 'break-room',
        name: 'Break Room',
        type: 'break',
        bounds: { x: 1376, y: 576, width: 288, height: 256 },
        capacity: 15,
        equipment: ['coffeeMachine', 'fridge', 'microwave'],
        bookable: false,
        status: 'available',
        color: '#fff3e0',
        borderColor: '#ff9800',
      },
    ],

    // Decorations
    decorations: [
      // Plants throughout
      { id: 'plant-1', type: 'plantLarge', position: { x: 48, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-2', type: 'plantLarge', position: { x: 592, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-3', type: 'plantLarge', position: { x: 1200, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-4', type: 'plantMedium', position: { x: 48, y: 960 }, dimensions: { width: 36, height: 36 } },
      { id: 'plant-5', type: 'plantMedium', position: { x: 592, y: 960 }, dimensions: { width: 36, height: 36 } },
      { id: 'plant-6', type: 'plantLarge', position: { x: 1920, y: 48 }, dimensions: { width: 48, height: 48 } },
      
      // Whiteboards
      { id: 'whiteboard-eng', type: 'whiteboard', position: { x: 64, y: 448 }, dimensions: { width: 160, height: 48 }, interactive: true, interactionRadius: 100 },
      { id: 'whiteboard-sales', type: 'whiteboard', position: { x: 736, y: 448 }, dimensions: { width: 160, height: 48 }, interactive: true, interactionRadius: 100 },
      
      // Break room furniture
      { id: 'coffee-1', type: 'coffeeMachine', position: { x: 1408, y: 608 }, dimensions: { width: 48, height: 48 }, interactive: true, interactionRadius: 80 },
      { id: 'couch-1', type: 'couch', position: { x: 1408, y: 720 }, dimensions: { width: 160, height: 64 } },
      { id: 'couch-2', type: 'couch', position: { x: 1600, y: 640 }, dimensions: { width: 64, height: 160 }, rotation: 90 },
      
      // Reception area
      { id: 'plant-reception', type: 'plantLarge', position: { x: 1600, y: 1088 }, dimensions: { width: 48, height: 48 } },
      
      // Artwork
      { id: 'artwork-1', type: 'artwork', position: { x: 1380, y: 1056 }, dimensions: { width: 64, height: 48 } },
    ],

    // Walls - with proper doors
    walls: [
      // === OUTER WALLS (with entrance door bottom-right) ===
      { id: 'wall-top', start: { x: 0, y: 0 }, end: { x: width, y: 0 }, thickness: WALL },
      { id: 'wall-left', start: { x: 0, y: 0 }, end: { x: 0, y: height }, thickness: WALL },
      { id: 'wall-right', start: { x: width - WALL, y: 0 }, end: { x: width - WALL, y: height }, thickness: WALL },
      // Bottom wall with entrance door
      { id: 'wall-bottom-left', start: { x: 0, y: height - WALL }, end: { x: 1600, y: height - WALL }, thickness: WALL },
      { id: 'wall-bottom-right', start: { x: 1728, y: height - WALL }, end: { x: width, y: height - WALL }, thickness: WALL }, // Door: 1600-1728
      
      // === MAIN CORRIDOR DIVIDERS (vertical line at x=1280) ===
      // Top section divider (with door)
      { id: 'div-top-upper', start: { x: 1280, y: WALL }, end: { x: 1280, y: 192 }, thickness: ROOM_WALL },
      { id: 'div-top-lower', start: { x: 1280, y: 288 }, end: { x: 1280, y: 480 }, thickness: ROOM_WALL }, // Door: 192-288
      // Bottom section divider (with door)
      { id: 'div-bottom-upper', start: { x: 1280, y: 544 }, end: { x: 1280, y: 928 }, thickness: ROOM_WALL },
      { id: 'div-bottom-lower', start: { x: 1280, y: 1024 }, end: { x: 1280, y: height - WALL }, thickness: ROOM_WALL }, // Door: 928-1024
      
      // === EXECUTIVE WING WALLS ===
      // Bottom wall of executive area (with door)
      { id: 'exec-bottom-left', start: { x: 1344, y: 512 }, end: { x: 1536, y: 512 }, thickness: ROOM_WALL },
      { id: 'exec-bottom-right', start: { x: 1632, y: 512 }, end: { x: width - WALL, y: 512 }, thickness: ROOM_WALL }, // Door: 1536-1632
      // Executive office dividers
      { id: 'exec-div-v1', start: { x: 1600, y: WALL }, end: { x: 1600, y: 192 }, thickness: ROOM_WALL },
      { id: 'exec-div-v2', start: { x: 1600, y: 224 }, end: { x: 1600, y: 512 }, thickness: ROOM_WALL }, // Door at 192-224
      { id: 'exec-div-h', start: { x: 1344, y: 256 }, end: { x: width - WALL, y: 256 }, thickness: ROOM_WALL, hasDoor: true },
      
      // === CONFERENCE ROOM WALLS ===
      // Left wall (with door)
      { id: 'conf-left-top', start: { x: 1664, y: 576 }, end: { x: 1664, y: 700 }, thickness: ROOM_WALL },
      { id: 'conf-left-bottom', start: { x: 1664, y: 796 }, end: { x: 1664, y: 832 }, thickness: ROOM_WALL }, // Door: 700-796
      // Top wall
      { id: 'conf-top', start: { x: 1664, y: 576 }, end: { x: width - WALL, y: 576 }, thickness: ROOM_WALL },
      // Bottom wall
      { id: 'conf-bottom', start: { x: 1664, y: 832 }, end: { x: width - WALL, y: 832 }, thickness: ROOM_WALL },
      
      // === MEETING ROOM A WALLS ===
      { id: 'meet-a-top', start: { x: 1664, y: 864 }, end: { x: width - WALL, y: 864 }, thickness: ROOM_WALL },
      { id: 'meet-a-left-top', start: { x: 1664, y: 864 }, end: { x: 1664, y: 928 }, thickness: ROOM_WALL },
      { id: 'meet-a-left-bottom', start: { x: 1664, y: 992 }, end: { x: 1664, y: 1024 }, thickness: ROOM_WALL }, // Door: 928-992
      { id: 'meet-a-bottom', start: { x: 1664, y: 1024 }, end: { x: width - WALL, y: 1024 }, thickness: ROOM_WALL },
      
      // === MEETING ROOM B WALLS ===
      { id: 'meet-b-top', start: { x: 1664, y: 1056 }, end: { x: width - WALL, y: 1056 }, thickness: ROOM_WALL },
      { id: 'meet-b-left-top', start: { x: 1664, y: 1056 }, end: { x: 1664, y: 1120 }, thickness: ROOM_WALL },
      { id: 'meet-b-left-bottom', start: { x: 1664, y: 1184 }, end: { x: 1664, y: 1216 }, thickness: ROOM_WALL }, // Door: 1120-1184
      { id: 'meet-b-bottom', start: { x: 1664, y: 1216 }, end: { x: width - WALL, y: 1216 }, thickness: ROOM_WALL },
      
      // === MEETING ROOM C WALLS ===
      { id: 'meet-c-top', start: { x: 1664, y: 1248 }, end: { x: width - WALL, y: 1248 }, thickness: ROOM_WALL },
      { id: 'meet-c-left-top', start: { x: 1664, y: 1248 }, end: { x: 1664, y: 1296 }, thickness: ROOM_WALL },
      { id: 'meet-c-left-bottom', start: { x: 1664, y: 1360 }, end: { x: 1664, y: height - WALL }, thickness: ROOM_WALL }, // Door: 1296-1360
      
      // === BREAK ROOM WALLS ===
      // Top wall
      { id: 'break-top', start: { x: 1344, y: 576 }, end: { x: 1664, y: 576 }, thickness: ROOM_WALL },
      // Bottom wall (with door)
      { id: 'break-bottom-left', start: { x: 1344, y: 832 }, end: { x: 1440, y: 832 }, thickness: ROOM_WALL },
      { id: 'break-bottom-right', start: { x: 1536, y: 832 }, end: { x: 1664, y: 832 }, thickness: ROOM_WALL }, // Door: 1440-1536
      
      // === PHONE BOOTH WALLS ===
      // Booth 1
      { id: 'booth1-right', start: { x: 1344, y: 576 }, end: { x: 1344, y: 672 }, thickness: ROOM_WALL },
      { id: 'booth1-bottom-left', start: { x: 1248, y: 672 }, end: { x: 1280, y: 672 }, thickness: ROOM_WALL },
      { id: 'booth1-bottom-right', start: { x: 1312, y: 672 }, end: { x: 1344, y: 672 }, thickness: ROOM_WALL }, // Door: 1280-1312
      // Booth 2
      { id: 'booth2-bottom-left', start: { x: 1248, y: 800 }, end: { x: 1280, y: 800 }, thickness: ROOM_WALL },
      { id: 'booth2-bottom-right', start: { x: 1312, y: 800 }, end: { x: 1344, y: 800 }, thickness: ROOM_WALL }, // Door: 1280-1312
      // Booth 3
      { id: 'booth3-bottom-left', start: { x: 1248, y: 928 }, end: { x: 1280, y: 928 }, thickness: ROOM_WALL },
      { id: 'booth3-bottom-right', start: { x: 1312, y: 928 }, end: { x: 1344, y: 928 }, thickness: ROOM_WALL }, // Door: 1280-1312
      
      // === RECEPTION WALLS ===
      { id: 'recep-top', start: { x: 1344, y: 1024 }, end: { x: 1664, y: 1024 }, thickness: ROOM_WALL },
      { id: 'recep-left-top', start: { x: 1344, y: 1024 }, end: { x: 1344, y: 1120 }, thickness: ROOM_WALL },
      { id: 'recep-left-bottom', start: { x: 1344, y: 1216 }, end: { x: 1344, y: height - WALL }, thickness: ROOM_WALL }, // Door: 1120-1216
    ],

    // Spawn points
    spawnPoints: [
      { id: 'spawn-default', position: { x: 1664, y: 1344 }, type: 'default' }, // At entrance
      { id: 'spawn-reception', position: { x: 1504, y: 1152 }, type: 'visitor' },
      { id: 'spawn-engineering', position: { x: 288, y: 224 }, type: 'department', departmentType: 'engineering' },
      { id: 'spawn-sales', position: { x: 928, y: 224 }, type: 'department', departmentType: 'sales' },
      { id: 'spawn-marketing', position: { x: 224, y: 704 }, type: 'department', departmentType: 'marketing' },
      { id: 'spawn-operations', position: { x: 864, y: 704 }, type: 'department', departmentType: 'operations' },
      { id: 'spawn-leadership', position: { x: 1504, y: 288 }, type: 'department', departmentType: 'leadership' },
    ],

    // Pathways
    pathways: [
      // Main horizontal corridor
      {
        id: 'corridor-main-h',
        points: [{ x: WALL, y: 512 }, { x: 1280, y: 512 }],
        width: CORRIDOR_W,
        isMainCorridor: true,
      },
      // Vertical corridor (department divider)
      {
        id: 'corridor-v-center',
        points: [{ x: 672, y: WALL }, { x: 672, y: height - WALL }],
        width: 96,
        isMainCorridor: true,
      },
      // Right side vertical corridor
      {
        id: 'corridor-v-right',
        points: [{ x: 1312, y: WALL }, { x: 1312, y: height - WALL }],
        width: 64,
        isMainCorridor: true,
      },
    ],
  }
}

export default corporateOfficeTemplate
