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
