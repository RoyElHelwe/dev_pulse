// Template 5: Enterprise Floor (50-100 people)
// Professional large-scale layout with proper walls and doors

import { OfficeTemplate, OfficeLayoutData } from '../types'

export const enterpriseFloorTemplate: OfficeTemplate = {
  id: 'enterprise-floor',
  name: 'Enterprise Floor',
  description: 'Large-scale layout for multi-team organizations with distinct department zones, town hall area, and executive wing',
  category: 'ENTERPRISE',
  minTeamSize: 50,
  maxTeamSize: 100,
  tags: ['enterprise', 'large-scale', 'departments', 'town-hall', 'executive'],
  layout: createEnterpriseFloorLayout(),
}

function createEnterpriseFloorLayout(): OfficeLayoutData {
  const TILE = 32
  const WALL = TILE
  const ROOM_WALL = 16
  const DESK_W = 96
  const DESK_H = 64

  const width = 2560  // 80 tiles
  const height = 1600 // 50 tiles

  return {
    metadata: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      mode: 'TEMPLATE',
      teamSize: 75,
      templateId: 'enterprise-floor',
    },
    dimensions: { width, height },
    
    zones: [
      { id: 'zone-engineering', type: 'engineering', name: 'Engineering', bounds: { x: 64, y: 64, width: 640, height: 448 }, color: 'rgba(66, 133, 244, 0.15)', departmentType: 'engineering', rules: { allowHotDesks: false, focusMode: true, allowInteractions: ['wave', 'message', 'knock'], notificationsEnabled: true } },
      { id: 'zone-product', type: 'product', name: 'Product', bounds: { x: 768, y: 64, width: 384, height: 320 }, color: 'rgba(0, 188, 212, 0.15)', departmentType: 'product', rules: { allowHotDesks: false, focusMode: false, allowInteractions: ['wave', 'call', 'message', 'invite'], notificationsEnabled: true } },
      { id: 'zone-sales', type: 'sales', name: 'Sales', bounds: { x: 1216, y: 64, width: 448, height: 320 }, color: 'rgba(76, 175, 80, 0.15)', departmentType: 'sales', rules: { allowHotDesks: false, focusMode: false, allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'], notificationsEnabled: true } },
      { id: 'zone-leadership', type: 'leadership', name: 'Executive Wing', bounds: { x: 1728, y: 64, width: 384, height: 384 }, color: 'rgba(156, 39, 176, 0.15)', departmentType: 'leadership', rules: { allowHotDesks: false, focusMode: false, allowInteractions: ['knock', 'message', 'urgent'], notificationsEnabled: true } },
      { id: 'zone-reception', type: 'reception', name: 'Reception', bounds: { x: 2176, y: 64, width: 320, height: 256 }, color: 'rgba(0, 150, 136, 0.15)', rules: { allowHotDesks: false, focusMode: false, allowInteractions: ['wave', 'call', 'message'], notificationsEnabled: true } },
      { id: 'zone-operations', type: 'operations', name: 'Operations', bounds: { x: 64, y: 576, width: 448, height: 320 }, color: 'rgba(255, 235, 59, 0.15)', departmentType: 'operations', rules: { allowHotDesks: false, focusMode: false, allowInteractions: ['wave', 'call', 'message', 'invite'], notificationsEnabled: true } },
      { id: 'zone-marketing', type: 'marketing', name: 'Marketing', bounds: { x: 576, y: 576, width: 384, height: 320 }, color: 'rgba(255, 152, 0, 0.15)', departmentType: 'marketing', rules: { allowHotDesks: false, focusMode: false, allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'], notificationsEnabled: true } },
      { id: 'zone-hr', type: 'hr', name: 'HR', bounds: { x: 64, y: 960, width: 320, height: 256 }, color: 'rgba(233, 30, 99, 0.15)', departmentType: 'hr', rules: { allowHotDesks: false, focusMode: false, allowInteractions: ['wave', 'call', 'message', 'invite'], notificationsEnabled: true } },
      { id: 'zone-finance', type: 'finance', name: 'Finance', bounds: { x: 448, y: 960, width: 320, height: 256 }, color: 'rgba(139, 195, 74, 0.15)', departmentType: 'finance', rules: { allowHotDesks: false, focusMode: true, allowInteractions: ['wave', 'message', 'knock'], notificationsEnabled: true } },
      { id: 'zone-townhall', type: 'collaboration', name: 'Town Hall', bounds: { x: 1024, y: 544, width: 512, height: 384 }, color: 'rgba(103, 58, 183, 0.15)', rules: { allowHotDesks: true, focusMode: false, allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'], notificationsEnabled: true } },
    ],

    desks: [
      // Engineering (16 desks)
      ...Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => ({
        id: `desk-eng-${r * 4 + c + 1}`, position: { x: 96 + c * 128, y: 96 + r * 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard' as const, zoneId: 'zone-engineering', facing: r % 2 === 0 ? 'south' as const : 'north' as const, isHotDesk: false, status: 'available' as const
      }))).flat(),
      // Product (6 desks)
      ...Array.from({ length: 2 }, (_, r) => Array.from({ length: 3 }, (_, c) => ({
        id: `desk-prod-${r * 3 + c + 1}`, position: { x: 800 + c * 128, y: 96 + r * 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard' as const, zoneId: 'zone-product', facing: r % 2 === 0 ? 'south' as const : 'north' as const, isHotDesk: false, status: 'available' as const
      }))).flat(),
      // Sales (9 desks)
      ...Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) => ({
        id: `desk-sales-${r * 3 + c + 1}`, position: { x: 1248 + c * 128, y: 96 + r * 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard' as const, zoneId: 'zone-sales', facing: r % 2 === 0 ? 'south' as const : 'north' as const, isHotDesk: false, status: 'available' as const
      }))).flat(),
      // Executive (4 desks)
      { id: 'desk-exec-1', position: { x: 1760, y: 96 }, dimensions: { width: 128, height: 80 }, type: 'executive' as const, zoneId: 'zone-leadership', facing: 'south' as const, isHotDesk: false, status: 'available' as const },
      { id: 'desk-exec-2', position: { x: 1920, y: 96 }, dimensions: { width: 128, height: 80 }, type: 'executive' as const, zoneId: 'zone-leadership', facing: 'south' as const, isHotDesk: false, status: 'available' as const },
      { id: 'desk-exec-3', position: { x: 1760, y: 224 }, dimensions: { width: 128, height: 80 }, type: 'executive' as const, zoneId: 'zone-leadership', facing: 'south' as const, isHotDesk: false, status: 'available' as const },
      { id: 'desk-exec-4', position: { x: 1920, y: 224 }, dimensions: { width: 128, height: 80 }, type: 'executive' as const, zoneId: 'zone-leadership', facing: 'south' as const, isHotDesk: false, status: 'available' as const },
      // Reception
      { id: 'desk-reception', position: { x: 2240, y: 128 }, dimensions: { width: 160, height: 64 }, type: 'standard' as const, zoneId: 'zone-reception', facing: 'south' as const, isHotDesk: false, status: 'available' as const },
      // Operations (8 desks)
      ...Array.from({ length: 2 }, (_, r) => Array.from({ length: 4 }, (_, c) => ({
        id: `desk-ops-${r * 4 + c + 1}`, position: { x: 96 + c * 128, y: 608 + r * 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard' as const, zoneId: 'zone-operations', facing: r % 2 === 0 ? 'south' as const : 'north' as const, isHotDesk: false, status: 'available' as const
      }))).flat(),
      // Marketing (6 desks)
      ...Array.from({ length: 2 }, (_, r) => Array.from({ length: 3 }, (_, c) => ({
        id: `desk-mkt-${r * 3 + c + 1}`, position: { x: 608 + c * 128, y: 608 + r * 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard' as const, zoneId: 'zone-marketing', facing: r % 2 === 0 ? 'south' as const : 'north' as const, isHotDesk: false, status: 'available' as const
      }))).flat(),
      // HR (4 desks)
      ...Array.from({ length: 2 }, (_, r) => Array.from({ length: 2 }, (_, c) => ({
        id: `desk-hr-${r * 2 + c + 1}`, position: { x: 96 + c * 128, y: 992 + r * 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard' as const, zoneId: 'zone-hr', facing: r % 2 === 0 ? 'south' as const : 'north' as const, isHotDesk: false, status: 'available' as const
      }))).flat(),
      // Finance (4 desks)
      ...Array.from({ length: 2 }, (_, r) => Array.from({ length: 2 }, (_, c) => ({
        id: `desk-fin-${r * 2 + c + 1}`, position: { x: 480 + c * 128, y: 992 + r * 96 }, dimensions: { width: DESK_W, height: DESK_H }, type: 'standard' as const, zoneId: 'zone-finance', facing: r % 2 === 0 ? 'south' as const : 'north' as const, isHotDesk: false, status: 'available' as const
      }))).flat(),
    ],

    rooms: [
      { id: 'conference-main', name: 'Main Conference', type: 'conference', bounds: { x: 1600, y: 544, width: 352, height: 256 }, capacity: 20, equipment: ['projector', 'whiteboard', 'video-conference', 'microphone'], bookable: true, status: 'available', color: '#e3f2fd', borderColor: '#2196f3' },
      { id: 'meeting-a', name: 'Meeting Room A', type: 'meeting', bounds: { x: 1984, y: 544, width: 224, height: 192 }, capacity: 10, equipment: ['projector', 'whiteboard', 'video-conference'], bookable: true, status: 'available', color: '#e8f5e9', borderColor: '#4caf50' },
      { id: 'meeting-b', name: 'Meeting Room B', type: 'meeting', bounds: { x: 2240, y: 544, width: 192, height: 160 }, capacity: 6, equipment: ['whiteboard', 'video-conference'], bookable: true, status: 'available', color: '#e8f5e9', borderColor: '#4caf50' },
      { id: 'meeting-c', name: 'Meeting Room C', type: 'meeting', bounds: { x: 2240, y: 736, width: 192, height: 160 }, capacity: 4, equipment: ['whiteboard'], bookable: true, status: 'available', color: '#e8f5e9', borderColor: '#4caf50' },
      { id: 'phone-booth-1', name: 'Phone Booth 1', type: 'phone-booth', bounds: { x: 1600, y: 832, width: 96, height: 96 }, capacity: 1, equipment: [], bookable: false, status: 'available', color: '#fce4ec', borderColor: '#e91e63' },
      { id: 'phone-booth-2', name: 'Phone Booth 2', type: 'phone-booth', bounds: { x: 1728, y: 832, width: 96, height: 96 }, capacity: 1, equipment: [], bookable: false, status: 'available', color: '#fce4ec', borderColor: '#e91e63' },
      { id: 'phone-booth-3', name: 'Phone Booth 3', type: 'phone-booth', bounds: { x: 1856, y: 832, width: 96, height: 96 }, capacity: 1, equipment: [], bookable: false, status: 'available', color: '#fce4ec', borderColor: '#e91e63' },
      { id: 'break-main', name: 'Main Cafeteria', type: 'break', bounds: { x: 1600, y: 992, width: 384, height: 288 }, capacity: 40, equipment: ['coffee-machine', 'fridge', 'microwave', 'vending-machines'], bookable: false, status: 'available', color: '#fff3e0', borderColor: '#ff9800' },
      { id: 'townhall-stage', name: 'Town Hall Stage', type: 'conference', bounds: { x: 1056, y: 576, width: 448, height: 96 }, capacity: 0, equipment: ['projector', 'microphone', 'podium'], bookable: true, status: 'available', color: '#ede7f6', borderColor: '#673ab7' },
    ],

    decorations: [
      { id: 'plant-1', type: 'plant-large', position: { x: 48, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-2', type: 'plant-large', position: { x: 736, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-3', type: 'plant-large', position: { x: 1184, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-4', type: 'plant-large', position: { x: 1696, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-5', type: 'plant-large', position: { x: 2464, y: 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-6', type: 'plant-medium', position: { x: 48, y: 1504 }, dimensions: { width: 36, height: 36 } },
      { id: 'plant-7', type: 'plant-medium', position: { x: 832, y: 1504 }, dimensions: { width: 36, height: 36 } },
      { id: 'whiteboard-eng', type: 'whiteboard', position: { x: 96, y: 448 }, dimensions: { width: 160, height: 48 }, interactive: true, interactionRadius: 100 },
      { id: 'whiteboard-sales', type: 'whiteboard', position: { x: 1248, y: 320 }, dimensions: { width: 160, height: 48 }, interactive: true, interactionRadius: 100 },
      { id: 'coffee-main', type: 'coffee-machine', position: { x: 1632, y: 1024 }, dimensions: { width: 48, height: 48 }, interactive: true, interactionRadius: 80 },
      { id: 'couch-reception', type: 'couch', position: { x: 2208, y: 224 }, dimensions: { width: 128, height: 64 } },
    ],

    walls: [
      // Outer walls
      { id: 'wall-top', start: { x: 0, y: 0 }, end: { x: width, y: 0 }, thickness: WALL },
      { id: 'wall-left', start: { x: 0, y: 0 }, end: { x: 0, y: height }, thickness: WALL },
      { id: 'wall-right', start: { x: width - WALL, y: 0 }, end: { x: width - WALL, y: height }, thickness: WALL },
      { id: 'wall-bottom-left', start: { x: 0, y: height - WALL }, end: { x: 2112, y: height - WALL }, thickness: WALL },
      { id: 'wall-bottom-right', start: { x: 2208, y: height - WALL }, end: { x: width, y: height - WALL }, thickness: WALL }, // Door
      // Executive wing
      { id: 'exec-left-top', start: { x: 1696, y: WALL }, end: { x: 1696, y: 192 }, thickness: ROOM_WALL },
      { id: 'exec-left-bottom', start: { x: 1696, y: 288 }, end: { x: 1696, y: 480 }, thickness: ROOM_WALL },
      { id: 'exec-bottom', start: { x: 1696, y: 480 }, end: { x: 2144, y: 480 }, thickness: ROOM_WALL },
      // Reception
      { id: 'recep-left-top', start: { x: 2144, y: WALL }, end: { x: 2144, y: 160 }, thickness: ROOM_WALL },
      { id: 'recep-left-bottom', start: { x: 2144, y: 256 }, end: { x: 2144, y: 352 }, thickness: ROOM_WALL },
      { id: 'recep-bottom', start: { x: 2144, y: 352 }, end: { x: width - WALL, y: 352 }, thickness: ROOM_WALL },
      // Conference room
      { id: 'conf-top', start: { x: 1568, y: 512 }, end: { x: 1984, y: 512 }, thickness: ROOM_WALL },
      { id: 'conf-left-top', start: { x: 1568, y: 512 }, end: { x: 1568, y: 640 }, thickness: ROOM_WALL },
      { id: 'conf-left-bottom', start: { x: 1568, y: 736 }, end: { x: 1568, y: 832 }, thickness: ROOM_WALL },
      { id: 'conf-bottom', start: { x: 1568, y: 832 }, end: { x: 1984, y: 832 }, thickness: ROOM_WALL },
      { id: 'conf-right', start: { x: 1984, y: 512 }, end: { x: 1984, y: 832 }, thickness: ROOM_WALL },
      // Meeting rooms
      { id: 'meet-a-top', start: { x: 1984, y: 512 }, end: { x: 2240, y: 512 }, thickness: ROOM_WALL },
      { id: 'meet-a-left-top', start: { x: 1984, y: 512 }, end: { x: 1984, y: 576 }, thickness: ROOM_WALL },
      { id: 'meet-a-left-bottom', start: { x: 1984, y: 672 }, end: { x: 1984, y: 768 }, thickness: ROOM_WALL },
      { id: 'meet-a-bottom', start: { x: 1984, y: 768 }, end: { x: 2240, y: 768 }, thickness: ROOM_WALL },
      { id: 'meet-b-top', start: { x: 2208, y: 512 }, end: { x: width - WALL, y: 512 }, thickness: ROOM_WALL },
      { id: 'meet-b-left-top', start: { x: 2208, y: 512 }, end: { x: 2208, y: 576 }, thickness: ROOM_WALL },
      { id: 'meet-b-left-bottom', start: { x: 2208, y: 672 }, end: { x: 2208, y: 736 }, thickness: ROOM_WALL },
      { id: 'meet-b-bottom', start: { x: 2208, y: 736 }, end: { x: width - WALL, y: 736 }, thickness: ROOM_WALL },
      { id: 'meet-c-top', start: { x: 2208, y: 736 }, end: { x: width - WALL, y: 736 }, thickness: ROOM_WALL },
      { id: 'meet-c-left-top', start: { x: 2208, y: 736 }, end: { x: 2208, y: 800 }, thickness: ROOM_WALL },
      { id: 'meet-c-left-bottom', start: { x: 2208, y: 864 }, end: { x: 2208, y: 928 }, thickness: ROOM_WALL },
      { id: 'meet-c-bottom', start: { x: 2208, y: 928 }, end: { x: width - WALL, y: 928 }, thickness: ROOM_WALL },
      // Cafeteria
      { id: 'cafe-top', start: { x: 1568, y: 960 }, end: { x: 2016, y: 960 }, thickness: ROOM_WALL },
      { id: 'cafe-left-top', start: { x: 1568, y: 960 }, end: { x: 1568, y: 1088 }, thickness: ROOM_WALL },
      { id: 'cafe-left-bottom', start: { x: 1568, y: 1184 }, end: { x: 1568, y: height - WALL }, thickness: ROOM_WALL },
      { id: 'cafe-right', start: { x: 2016, y: 960 }, end: { x: 2016, y: height - WALL }, thickness: ROOM_WALL },
      // Town hall separator
      { id: 'th-left-top', start: { x: 992, y: 512 }, end: { x: 992, y: 640 }, thickness: ROOM_WALL },
      { id: 'th-left-bottom', start: { x: 992, y: 736 }, end: { x: 992, y: 960 }, thickness: ROOM_WALL },
      { id: 'th-right', start: { x: 1568, y: 512 }, end: { x: 1568, y: 960 }, thickness: ROOM_WALL },
      { id: 'th-bottom', start: { x: 992, y: 960 }, end: { x: 1568, y: 960 }, thickness: ROOM_WALL },
    ],

    spawnPoints: [
      { id: 'spawn-default', position: { x: 2160, y: 1536 }, type: 'default' },
      { id: 'spawn-reception', position: { x: 2304, y: 256 }, type: 'visitor' },
      { id: 'spawn-engineering', position: { x: 352, y: 288 }, type: 'department', departmentType: 'engineering' },
      { id: 'spawn-sales', position: { x: 1408, y: 192 }, type: 'department', departmentType: 'sales' },
      { id: 'spawn-leadership', position: { x: 1888, y: 288 }, type: 'department', departmentType: 'leadership' },
    ],

    pathways: [
      { id: 'corridor-main-h', points: [{ x: WALL, y: 512 }, { x: width - WALL, y: 512 }], width: 96, isMainCorridor: true },
      { id: 'corridor-main-v', points: [{ x: 992, y: WALL }, { x: 992, y: height - WALL }], width: 96, isMainCorridor: true },
      { id: 'corridor-v-right', points: [{ x: 1568, y: WALL }, { x: 1568, y: height - WALL }], width: 64, isMainCorridor: true },
    ],
  }
}

export default enterpriseFloorTemplate
