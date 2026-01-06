// Game Constants

export const GAME_CONFIG = {
  // Canvas size
  WIDTH: 1200,
  HEIGHT: 800,
  
  // Tile size for grid
  TILE_SIZE: 32,
  
  // Player settings
  PLAYER_SPEED: 200,
  PLAYER_SIZE: 28,
  
  // Colors (no assets, using graphics)
  COLORS: {
    // Floor
    FLOOR: 0xf5f5dc, // Beige
    FLOOR_GRID: 0xe5e5c5,
    
    // Walls
    WALL: 0x4a5568,
    WALL_DARK: 0x2d3748,
    
    // Furniture
    DESK: 0x8b4513, // Brown
    DESK_TOP: 0xd2b48c, // Tan
    CHAIR: 0x2563eb, // Blue
    
    // Rooms
    MEETING_ROOM: 0xe8f5e9,
    MEETING_ROOM_BORDER: 0x4caf50,
    BREAK_ROOM: 0xfff3e0,
    BREAK_ROOM_BORDER: 0xff9800,
    
    // Decorations
    PLANT: 0x228b22,
    WHITEBOARD: 0xffffff,
    WHITEBOARD_BORDER: 0x9e9e9e,
    COFFEE_MACHINE: 0x5d4037,
    
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
