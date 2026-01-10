// Game Constants
import { PHASER_COLORS, hexToNumber, OFFICE_COLORS } from './assets/office-theme';

export const GAME_CONFIG = {
  // Canvas size - large enough for most screens
  WIDTH: 2400,
  HEIGHT: 1600,
  
  // Tile size for grid
  TILE_SIZE: 32,
  
  // Player settings
  PLAYER_SPEED: 200,
  PLAYER_SIZE: 28,
  
  // Furniture dimensions
  FURNITURE: {
    MONITOR_WIDTH: 25,
    MONITOR_HEIGHT: 18,
    MONITOR_STAND_WIDTH: 6,
    MONITOR_STAND_HEIGHT: 5,
    DESK_CHAIR_SIZE: 24,
    MEETING_CHAIR_SIZE: 20,
    CHAIR_OFFSET: 8,
    COFFEE_TABLE_OFFSET_X: 120,
    COFFEE_TABLE_OFFSET_Y: 10,
    COFFEE_TABLE_WIDTH: 60,
    COFFEE_TABLE_HEIGHT: 30,
  },
  
  // Colors - now using shared theme for consistency with LayoutPreview
  COLORS: {
    // Floor
    FLOOR: PHASER_COLORS.floor,
    FLOOR_GRID: PHASER_COLORS.floorGrid,
    
    // Walls
    WALL: PHASER_COLORS.wall,
    WALL_DARK: PHASER_COLORS.wallDark,
    
    // Furniture
    DESK: PHASER_COLORS.desk,
    DESK_TOP: PHASER_COLORS.deskTop,
    CHAIR: PHASER_COLORS.chair,
    
    // Rooms - keep existing room colors for now
    MEETING_ROOM: 0xe8f5e9,
    MEETING_ROOM_BORDER: 0x4caf50,
    BREAK_ROOM: 0xfff3e0,
    BREAK_ROOM_BORDER: 0xff9800,
    
    // Decorations
    PLANT: PHASER_COLORS.plant,
    WHITEBOARD: PHASER_COLORS.whiteboard,
    WHITEBOARD_BORDER: PHASER_COLORS.whiteboardFrame,
    COFFEE_MACHINE: PHASER_COLORS.coffeeMachine,
    
    // Additional colors from shared theme
    MONITOR: PHASER_COLORS.monitor,
    MONITOR_SCREEN: PHASER_COLORS.monitorScreen,
    POT: PHASER_COLORS.pot,
    COUCH: PHASER_COLORS.couch,
    COUCH_CUSHION: PHASER_COLORS.couchCushion,
    CHAIR_BORDER: PHASER_COLORS.chairBorder,
    
    // Player status indicators
    STATUS_ONLINE: 0x4caf50,
    STATUS_AWAY: 0xffc107,
    STATUS_BUSY: 0xf44336,
    STATUS_OFFLINE: 0x9e9e9e,
  },
  
  // Default office layout
  DEFAULT_OFFICE: {
    // Office dimensions in tiles
    TILES_X: 30,
    TILES_Y: 20,
    
    // Spawn point
    SPAWN_X: 400,
    SPAWN_Y: 400,
  },

  // Default layouts for OfficeBuilder
  DEFAULT_LAYOUTS: {
    MEETING_ROOMS: [
      {
        id: 'meeting-1',
        name: 'Meeting Room A',
        type: 'meeting',
        bounds: { x: 850, y: 50, width: 300, height: 200 },
        capacity: 8,
        equipment: [],
        bookable: true,
        status: 'available',
      },
      {
        id: 'meeting-2',
        name: 'Meeting Room B',
        type: 'meeting',
        bounds: { x: 50, y: 500, width: 250, height: 180 },
        capacity: 6,
        equipment: [],
        bookable: true,
        status: 'available',
      },
    ],
    BREAK_ROOM: {
      id: 'break',
      name: 'Break Room',
      type: 'break',
      bounds: { x: 900, y: 550, width: 250, height: 200 },
      capacity: 12,
      equipment: [],
      bookable: false,
      status: 'available',
    },
    DESKS: [
      // Row 1 (left side)
      { id: 'desk-1', position: { x: 100, y: 100 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-2', position: { x: 200, y: 100 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-3', position: { x: 300, y: 100 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-4', position: { x: 400, y: 100 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      // Row 2
      { id: 'desk-5', position: { x: 100, y: 200 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-6', position: { x: 200, y: 200 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-7', position: { x: 300, y: 200 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-8', position: { x: 400, y: 200 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      // Row 3
      { id: 'desk-9', position: { x: 100, y: 350 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-10', position: { x: 200, y: 350 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-11', position: { x: 300, y: 350 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-12', position: { x: 400, y: 350 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      // Center area desks
      { id: 'desk-13', position: { x: 550, y: 300 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-14', position: { x: 650, y: 300 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-15', position: { x: 550, y: 400 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
      { id: 'desk-16', position: { x: 650, y: 400 }, dimensions: { width: 80, height: 50 }, type: 'standard', zoneId: 'main', facing: 'south', isHotDesk: true, status: 'available' },
    ],
    DECORATIONS: [
      // Plants
      { id: 'plant-1', type: 'plant', position: { x: 60, y: 60 }, dimensions: { width: 30, height: 30 } },
      { id: 'plant-2', type: 'plant', position: { x: 500, y: 60 }, dimensions: { width: 30, height: 30 } },
      { id: 'plant-3', type: 'plant', position: { x: 800, y: 300 }, dimensions: { width: 30, height: 30 } },
      { id: 'plant-4', type: 'plant', position: { x: 60, y: 450 }, dimensions: { width: 30, height: 30 } },
      // Whiteboards
      { id: 'wb-1', type: 'whiteboard', position: { x: 520, y: 80 }, dimensions: { width: 60, height: 40 } },
      { id: 'wb-2', type: 'whiteboard', position: { x: 350, y: 500 }, dimensions: { width: 60, height: 40 } },
    ],
  },
}

// Direction vectors
export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

// Key mappings
export const KEY_MAPPINGS = {
  UP: ['W', 'ArrowUp'],
  DOWN: ['S', 'ArrowDown'],
  LEFT: ['A', 'ArrowLeft'],
  RIGHT: ['D', 'ArrowRight'],
}
