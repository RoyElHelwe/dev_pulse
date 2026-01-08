// Template 6: Hybrid Workspace (15-40 people)
// Grid-based professional layout with assigned + hot desk zones

import { OfficeTemplate, OfficeLayoutData, DecorationType } from '../types'

const T = 32, W = 32, RW = 16, DW = 96, DH = 64, DG = 32, DOOR = 96

export const hybridWorkspaceTemplate: OfficeTemplate = {
  id: 'hybrid-workspace',
  name: 'Hybrid Workspace',
  description: 'Modern workspace with 60/40 mix of assigned and hot desks, focus rooms, collaboration zones',
  category: 'HYBRID',
  minTeamSize: 15,
  maxTeamSize: 40,
  tags: ['hybrid', 'flexible', 'assigned-desks', 'hot-desks', 'modern'],
  layout: createHybridWorkspaceLayout(),
}

function createHybridWorkspaceLayout(): OfficeLayoutData {
  const width = 56 * T  // 1792
  const height = 38 * T // 1216

  // Zone positions (grid-based)
  const CORE_X = W + T, CORE_Y = W + T
  const FLEX_X = 20 * T, FLEX_Y = W + T
  const LEAD_X = 38 * T, LEAD_Y = W + T
  const COLLAB_X = W + T, COLLAB_Y = 18 * T
  const FOCUS_X = 20 * T, FOCUS_Y = 18 * T
  const MEET_X = 38 * T, MEET_Y = 14 * T
  const BREAK_X = 44 * T, BREAK_Y = 26 * T

  return {
    metadata: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      mode: 'TEMPLATE',
      teamSize: 30,
      templateId: 'hybrid-workspace',
    },
    dimensions: { width, height },

    zones: [
      { id: 'zone-core', name: 'Core Team Area', type: 'engineering', bounds: { x: CORE_X, y: CORE_Y, width: 17 * T, height: 15 * T }, color: 'rgba(66,133,244,0.15)', departmentType: 'engineering', rules: { allowHotDesks: false, focusMode: true, allowInteractions: ['wave', 'message', 'knock'], notificationsEnabled: true } },
      { id: 'zone-flex', name: 'Flex Zone', type: 'collaboration', bounds: { x: FLEX_X, y: FLEX_Y, width: 16 * T, height: 15 * T }, color: 'rgba(255,152,0,0.15)', rules: { allowHotDesks: true, focusMode: false, allowInteractions: ['wave', 'call', 'message', 'invite'], notificationsEnabled: true } },
      { id: 'zone-leadership', name: 'Leadership', type: 'leadership', bounds: { x: LEAD_X, y: LEAD_Y, width: 16 * T, height: 11 * T }, color: 'rgba(156,39,176,0.15)', departmentType: 'leadership', rules: { allowHotDesks: false, focusMode: false, allowInteractions: ['knock', 'message', 'urgent'], notificationsEnabled: true } },
      { id: 'zone-collab', name: 'Collaboration Hub', type: 'collaboration', bounds: { x: COLLAB_X, y: COLLAB_Y, width: 17 * T, height: 18 * T }, color: 'rgba(76,175,80,0.15)', rules: { allowHotDesks: true, focusMode: false, allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'], notificationsEnabled: true } },
      { id: 'zone-focus', name: 'Focus Zone', type: 'focus', bounds: { x: FOCUS_X, y: FOCUS_Y, width: 16 * T, height: 18 * T }, color: 'rgba(96,125,139,0.15)', rules: { allowHotDesks: true, focusMode: true, allowInteractions: ['message'], notificationsEnabled: false } },
      { id: 'zone-social', name: 'Social Lounge', type: 'social', bounds: { x: BREAK_X, y: BREAK_Y, width: 10 * T, height: 10 * T }, color: 'rgba(255,235,59,0.15)', rules: { allowHotDesks: true, focusMode: false, allowInteractions: ['wave', 'call', 'message', 'invite'], notificationsEnabled: true } },
    ],

    desks: [
      // Core Team - 12 assigned desks (3 rows x 4)
      ...Array.from({ length: 12 }, (_, i) => ({
        id: `desk-core-${i + 1}`,
        position: { x: CORE_X + T + (i % 4) * (DW + DG), y: CORE_Y + T + Math.floor(i / 4) * (DH * 2 + DG) },
        dimensions: { width: DW, height: DH },
        type: 'standard' as const,
        zoneId: 'zone-core',
        facing: (Math.floor(i / 4) % 2 === 0 ? 'south' : 'north') as 'south' | 'north',
        isHotDesk: false,
        status: 'available' as const,
      })),
      // Flex Zone - 10 hot desks (2 rows x 5)
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `desk-flex-${i + 1}`,
        position: { x: FLEX_X + T + (i % 5) * (DW + DG), y: FLEX_Y + T + Math.floor(i / 5) * (DH * 2 + DG) },
        dimensions: { width: DW, height: DH },
        type: 'hotdesk' as const,
        zoneId: 'zone-flex',
        facing: (Math.floor(i / 5) % 2 === 0 ? 'south' : 'north') as 'south' | 'north',
        isHotDesk: true,
        status: 'available' as const,
      })),
      // Leadership - 4 executive desks
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `desk-lead-${i + 1}`,
        position: { x: LEAD_X + T + (i % 2) * (DW + 64), y: LEAD_Y + T + Math.floor(i / 2) * (DH + 48) },
        dimensions: { width: DW + 32, height: DH },
        type: 'executive' as const,
        zoneId: 'zone-leadership',
        facing: (i < 2 ? 'south' : 'north') as 'south' | 'north',
        isHotDesk: false,
        status: 'available' as const,
      })),
      // Collab Zone - 8 project desks
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `desk-collab-${i + 1}`,
        position: { x: COLLAB_X + T + (i % 4) * (DW + DG), y: COLLAB_Y + 4 * T + Math.floor(i / 4) * (DH * 2 + DG) },
        dimensions: { width: DW, height: DH },
        type: 'hotdesk' as const,
        zoneId: 'zone-collab',
        facing: (Math.floor(i / 4) % 2 === 0 ? 'south' : 'north') as 'south' | 'north',
        isHotDesk: true,
        status: 'available' as const,
      })),
      // Focus Zone - 6 quiet desks
      ...Array.from({ length: 6 }, (_, i) => ({
        id: `desk-focus-${i + 1}`,
        position: { x: FOCUS_X + T + (i % 3) * (DW + 48), y: FOCUS_Y + 4 * T + Math.floor(i / 3) * (DH * 2 + 64) },
        dimensions: { width: DW, height: DH },
        type: 'standard' as const,
        zoneId: 'zone-focus',
        facing: 'south' as const,
        isHotDesk: true,
        status: 'available' as const,
      })),
    ],

    rooms: [
      { id: 'meeting-main', name: 'Main Meeting Room', type: 'meeting', bounds: { x: MEET_X, y: MEET_Y, width: 8 * T, height: 6 * T }, capacity: 10, equipment: ['projector', 'whiteboard', 'video-conference'], bookable: true, status: 'available', color: '#e8f5e9', borderColor: '#4caf50' },
      { id: 'meeting-b', name: 'Meeting Room B', type: 'meeting', bounds: { x: MEET_X, y: MEET_Y + 7 * T, width: 6 * T, height: 5 * T }, capacity: 6, equipment: ['whiteboard', 'video-conference'], bookable: true, status: 'available', color: '#e8f5e9', borderColor: '#4caf50' },
      { id: 'huddle', name: 'Huddle Room', type: 'meeting', bounds: { x: MEET_X + 9 * T, y: MEET_Y, width: 5 * T, height: 4 * T }, capacity: 4, equipment: ['whiteboard'], bookable: true, status: 'available', color: '#e8f5e9', borderColor: '#4caf50' },
      { id: 'focus-pod-1', name: 'Focus Pod 1', type: 'focus', bounds: { x: FOCUS_X + 12 * T, y: FOCUS_Y, width: 4 * T, height: 4 * T }, capacity: 1, equipment: [], bookable: true, status: 'available', color: '#eceff1', borderColor: '#607d8b' },
      { id: 'focus-pod-2', name: 'Focus Pod 2', type: 'focus', bounds: { x: FOCUS_X + 12 * T, y: FOCUS_Y + 5 * T, width: 4 * T, height: 4 * T }, capacity: 1, equipment: [], bookable: true, status: 'available', color: '#eceff1', borderColor: '#607d8b' },
      { id: 'phone-booth-1', name: 'Phone Booth 1', type: 'phone-booth', bounds: { x: 17 * T, y: 3 * T, width: 3 * T, height: 3 * T }, capacity: 1, equipment: [], bookable: false, status: 'available', color: '#fce4ec', borderColor: '#e91e63' },
      { id: 'phone-booth-2', name: 'Phone Booth 2', type: 'phone-booth', bounds: { x: 17 * T, y: 7 * T, width: 3 * T, height: 3 * T }, capacity: 1, equipment: [], bookable: false, status: 'available', color: '#fce4ec', borderColor: '#e91e63' },
      { id: 'phone-booth-3', name: 'Phone Booth 3', type: 'phone-booth', bounds: { x: 17 * T, y: 11 * T, width: 3 * T, height: 3 * T }, capacity: 1, equipment: [], bookable: false, status: 'available', color: '#fce4ec', borderColor: '#e91e63' },
      { id: 'break-room', name: 'Kitchen & Lounge', type: 'break', bounds: { x: BREAK_X, y: BREAK_Y, width: 10 * T, height: 10 * T }, capacity: 15, equipment: ['coffee-machine', 'fridge', 'microwave'], bookable: false, status: 'available', color: '#fff3e0', borderColor: '#ff9800' },
    ],

    decorations: [
      { id: 'plant-1', type: 'plantLarge' as DecorationType, position: { x: W, y: W }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-2', type: 'plantLarge' as DecorationType, position: { x: width - W - 48, y: W }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-3', type: 'plantLarge' as DecorationType, position: { x: W, y: height - W - 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'plant-4', type: 'plantLarge' as DecorationType, position: { x: width - W - 48, y: height - W - 48 }, dimensions: { width: 48, height: 48 } },
      { id: 'wb-collab-1', type: 'whiteboard' as DecorationType, position: { x: COLLAB_X + T, y: COLLAB_Y + T }, dimensions: { width: 128, height: 48 }, interactive: true, interactionRadius: 100 },
      { id: 'wb-collab-2', type: 'whiteboard' as DecorationType, position: { x: COLLAB_X + 10 * T, y: COLLAB_Y + T }, dimensions: { width: 128, height: 48 }, interactive: true, interactionRadius: 100 },
      { id: 'couch-1', type: 'couch' as DecorationType, position: { x: BREAK_X + T, y: BREAK_Y + T }, dimensions: { width: 128, height: 48 } },
      { id: 'couch-2', type: 'couch' as DecorationType, position: { x: BREAK_X + T, y: BREAK_Y + 4 * T }, dimensions: { width: 128, height: 48 } },
      { id: 'coffee', type: 'coffeeMachine' as DecorationType, position: { x: BREAK_X + 7 * T, y: BREAK_Y + T }, dimensions: { width: 48, height: 48 }, interactive: true, interactionRadius: 80 },
      { id: 'water', type: 'waterCooler' as DecorationType, position: { x: BREAK_X + 7 * T, y: BREAK_Y + 3 * T }, dimensions: { width: 32, height: 32 }, interactive: true, interactionRadius: 60 },
    ],

    walls: [
      { id: 'wall-top-l', start: { x: 0, y: 0 }, end: { x: width / 2 - DOOR / 2, y: 0 }, thickness: W },
      { id: 'wall-top-r', start: { x: width / 2 + DOOR / 2, y: 0 }, end: { x: width, y: 0 }, thickness: W },
      { id: 'wall-bottom', start: { x: 0, y: height - W }, end: { x: width, y: height - W }, thickness: W },
      { id: 'wall-left', start: { x: 0, y: 0 }, end: { x: 0, y: height }, thickness: W },
      { id: 'wall-right', start: { x: width - W, y: 0 }, end: { x: width - W, y: height }, thickness: W },
      { id: 'wall-core-t', start: { x: CORE_X + 17 * T, y: CORE_Y }, end: { x: CORE_X + 17 * T, y: CORE_Y + 6 * T }, thickness: RW },
      { id: 'wall-core-b', start: { x: CORE_X + 17 * T, y: CORE_Y + 6 * T + DOOR }, end: { x: CORE_X + 17 * T, y: CORE_Y + 15 * T }, thickness: RW },
      { id: 'wall-lead-l', start: { x: LEAD_X, y: LEAD_Y }, end: { x: LEAD_X, y: LEAD_Y + 4 * T }, thickness: RW },
      { id: 'wall-lead-r', start: { x: LEAD_X, y: LEAD_Y + 4 * T + DOOR }, end: { x: LEAD_X, y: LEAD_Y + 11 * T }, thickness: RW },
      { id: 'wall-meet-l', start: { x: MEET_X, y: MEET_Y }, end: { x: MEET_X, y: MEET_Y + 6 * T }, thickness: RW, hasDoor: true, doorPosition: { x: MEET_X, y: MEET_Y + 2 * T } },
      { id: 'wall-meet-b', start: { x: MEET_X, y: MEET_Y + 6 * T }, end: { x: MEET_X + 8 * T, y: MEET_Y + 6 * T }, thickness: RW },
      { id: 'wall-break-l', start: { x: BREAK_X, y: BREAK_Y }, end: { x: BREAK_X, y: BREAK_Y + 4 * T }, thickness: RW },
      { id: 'wall-break-b', start: { x: BREAK_X, y: BREAK_Y + 4 * T + DOOR }, end: { x: BREAK_X, y: BREAK_Y + 10 * T }, thickness: RW },
      { id: 'wall-break-top', start: { x: BREAK_X, y: BREAK_Y }, end: { x: BREAK_X + 10 * T, y: BREAK_Y }, thickness: RW },
    ],

    spawnPoints: [
      { id: 'spawn-main', position: { x: width / 2, y: W + T }, type: 'default' },
      { id: 'spawn-core', position: { x: CORE_X + 8 * T, y: CORE_Y + 7 * T }, type: 'department', departmentType: 'engineering' },
      { id: 'spawn-flex', position: { x: FLEX_X + 8 * T, y: FLEX_Y + 5 * T }, type: 'default' },
      { id: 'spawn-lead', position: { x: LEAD_X + 8 * T, y: LEAD_Y + 5 * T }, type: 'department', departmentType: 'leadership' },
    ],

    pathways: [
      { id: 'main-h', points: [{ x: W, y: 17 * T }, { x: width - W, y: 17 * T }], width: T * 3, isMainCorridor: true },
      { id: 'main-v', points: [{ x: 19 * T, y: W }, { x: 19 * T, y: height - W }], width: T * 2, isMainCorridor: true },
      { id: 'right-v', points: [{ x: 37 * T, y: W }, { x: 37 * T, y: height - W }], width: T * 2, isMainCorridor: true },
    ],
  }
}

export default hybridWorkspaceTemplate
