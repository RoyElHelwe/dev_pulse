/**
 * Tileset Configuration for Modern Office Assets
 * 
 * Maps tile indices to sprite paths and provides asset loading configuration.
 * Uses the Modern Office tileset pack from /office_map folder.
 */

export const TILESET_CONFIG = {
  // Base path for all tileset assets
  basePath: '/office_map',
  
  // Main tileset spritesheet (32x32 is our standard)
  mainTileset: {
    key: 'modern-office',
    path: '/office_map/Modern_Office_32x32.png',
    frameWidth: 32,
    frameHeight: 32,
    // Tileset is 32 columns wide
    columns: 32,
  },
  
  // Room builder tileset (for floors and walls)
  roomBuilder: {
    key: 'room-builder',
    path: '/office_map/1_Room_Builder_Office/Room_Builder_Office_32x32.png',
    frameWidth: 32,
    frameHeight: 32,
    columns: 32,
  },
  
  // Individual sprite path pattern
  singlesPath: '/office_map/4_Modern_Office_singles/32x32',
  singlesPrefix: 'Modern_Office_Singles_32x32_',
};

/**
 * Tile type mappings to spritesheet frame indices
 * These indices correspond to frames in the Modern_Office_32x32.png tileset
 */
export const TILE_FRAMES = {
  // Floor tiles
  floors: {
    wood: { start: 0, variants: [0, 1, 2, 3] },
    carpet: { start: 32, variants: [32, 33, 34, 35] },
    tile: { start: 64, variants: [64, 65, 66, 67] },
    concrete: { start: 96, variants: [96, 97] },
  },
  
  // Wall tiles
  walls: {
    horizontal: { top: 128, middle: 160, bottom: 192 },
    vertical: { left: 129, middle: 161, right: 193 },
    corners: {
      topLeft: 128,
      topRight: 131,
      bottomLeft: 224,
      bottomRight: 227,
    },
    door: { frame: 162 },
    window: { frame: 163 },
  },
  
  // Furniture - mapped to single sprites for better organization
  furniture: {
    // Desks
    deskSmall: 1,
    deskMedium: 2,
    deskLarge: 3,
    deskExecutive: 4,
    standingDesk: 5,
    
    // Chairs
    officeChair: 20,
    meetingChair: 21,
    executiveChair: 22,
    stool: 23,
    
    // Tables
    conferenceTable: 40,
    roundTable: 41,
    coffeeTable: 42,
    
    // Storage
    cabinet: 60,
    bookshelf: 61,
    drawer: 62,
    locker: 63,
  },
  
  // Decorations
  decorations: {
    // Plants
    plantSmall: 100,
    plantMedium: 101,
    plantLarge: 102,
    plantPot: 103,
    tree: 104,
    
    // Office equipment
    computer: 120,
    laptop: 121,
    monitor: 122,
    printer: 123,
    phone: 124,
    
    // Boards
    whiteboard: 140,
    corkboard: 141,
    tvScreen: 142,
    projector: 143,
    
    // Misc
    coffeeMachine: 160,
    waterCooler: 161,
    vendingMachine: 162,
    couch: 163,
    lamp: 164,
    rug: 165,
  },
};

/**
 * Single sprite asset configuration
 * Maps asset types to specific numbered sprites in the singles folder
 */
export const SINGLE_SPRITES = {
  // Desk variations (using approximate sprite numbers based on typical office tileset)
  desks: {
    standard: [1, 2, 3, 4, 5],
    standing: [6, 7],
    executive: [8, 9, 10],
    hot: [11, 12],
  },
  
  // Chair variations
  chairs: {
    office: [20, 21, 22, 23],
    meeting: [24, 25, 26],
    executive: [27, 28],
  },
  
  // Table variations
  tables: {
    conference: [40, 41, 42, 43, 44, 45],
    round: [46, 47],
    coffee: [48, 49],
  },
  
  // Plant variations
  plants: {
    small: [100, 101, 102],
    medium: [103, 104, 105],
    large: [106, 107],
    hanging: [108, 109],
  },
  
  // Equipment
  equipment: {
    computer: [120, 121],
    laptop: [122, 123],
    monitor: [124, 125, 126],
    printer: [127],
    phone: [128, 129],
  },
  
  // Walls and floors (from Room Builder)
  structural: {
    floorWood: [200, 201, 202, 203],
    floorCarpet: [204, 205, 206, 207],
    floorTile: [208, 209, 210, 211],
    wallLight: [220, 221, 222, 223],
    wallDark: [224, 225, 226, 227],
  },
};

/**
 * Zone-specific tile palettes
 * Maps zone types to appropriate floor and decoration tiles
 */
export const ZONE_TILE_PALETTES = {
  work: {
    floor: 'carpet',
    floorVariants: [32, 33, 34, 35],
    decorations: ['plantSmall', 'computer'],
    ambiance: 'professional',
  },
  meeting: {
    floor: 'carpet',
    floorVariants: [36, 37, 38, 39],
    decorations: ['whiteboard', 'plantMedium'],
    ambiance: 'collaborative',
  },
  break: {
    floor: 'tile',
    floorVariants: [64, 65, 66, 67],
    decorations: ['coffeeMachine', 'couch', 'vendingMachine'],
    ambiance: 'relaxed',
  },
  focus: {
    floor: 'carpet',
    floorVariants: [40, 41, 42, 43],
    decorations: ['plantSmall', 'lamp'],
    ambiance: 'quiet',
  },
  social: {
    floor: 'wood',
    floorVariants: [0, 1, 2, 3],
    decorations: ['couch', 'coffeeTable', 'plantLarge'],
    ambiance: 'casual',
  },
  creative: {
    floor: 'concrete',
    floorVariants: [96, 97, 98, 99],
    decorations: ['whiteboard', 'corkboard', 'plantMedium'],
    ambiance: 'inspiring',
  },
  reception: {
    floor: 'tile',
    floorVariants: [68, 69, 70, 71],
    decorations: ['plantLarge', 'couch'],
    ambiance: 'welcoming',
  },
  executive: {
    floor: 'wood',
    floorVariants: [4, 5, 6, 7],
    decorations: ['plantLarge', 'bookshelf', 'lamp'],
    ambiance: 'prestigious',
  },
};

/**
 * Color overlay mappings for zone highlighting
 */
export const ZONE_OVERLAYS = {
  work: 0x4a90d9,      // Blue
  meeting: 0x2ecc71,   // Green
  break: 0xe67e22,     // Orange
  focus: 0x9b59b6,     // Purple
  social: 0xf1c40f,    // Yellow
  creative: 0xe74c3c,  // Red
  reception: 0x1abc9c, // Teal
  executive: 0x8e44ad, // Dark Purple
};

export type ZoneType = keyof typeof ZONE_TILE_PALETTES;
export type FloorType = 'wood' | 'carpet' | 'tile' | 'concrete';
export type DecorationType = keyof typeof TILE_FRAMES['decorations'];
export type FurnitureType = keyof typeof TILE_FRAMES['furniture'];
