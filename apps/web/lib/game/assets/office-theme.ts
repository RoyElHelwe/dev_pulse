/**
 * Shared Office Theme Configuration
 * 
 * Defines colors, styles, and rendering parameters used consistently
 * across both the SVG preview (LayoutPreview) and Phaser game (OfficeBuilder).
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================

export const OFFICE_COLORS = {
  // Floor colors
  floor: {
    wood: { primary: '#c4a77d', secondary: '#d4b78d', line: '#b89a6d' },
    carpet: { primary: '#8b9a83', secondary: '#94a38c' },
    tile: { primary: '#e0e0e0', secondary: '#f0f0f0' },
  },
  
  // Wall colors
  wall: {
    primary: '#5c4033',
    secondary: '#6d4c41',
    highlight: '#8b7355',
  },
  
  // Desk colors
  desk: {
    body: '#8b4513',
    surface: '#d4a574',
    border: '#6b3410',
  },
  
  // Chair colors
  chair: {
    seat: '#3b82f6',
    border: '#2563eb',
    back: '#3b82f6',
  },
  
  // Monitor colors
  monitor: {
    frame: '#333333',
    screen: '#4fc3f7',
    stand: '#555555',
  },
  
  // Keyboard color
  keyboard: '#444444',
  
  // Plant colors
plant: {
  pot: '#8b4513',
  potBorder: '#5a2e0c',
  potRim: '#a0522d',
  stem: '#1f7a1f',
  leaf1: '#1e8f3e',
  leaf2: '#2ecc71',
  leaf3: '#27ae60',
  shadow: 'rgba(0,0,0,0.15)',
},
  
  // Whiteboard colors
  whiteboard: {
    frame: '#888888',
    surface: '#f8f8f8',
    tray: '#666666',
  },
  
  // Coffee machine colors
  coffeeMachine: {
    body: '#4a4a4a',
    panel: '#222222',
    indicator: '#dc2626',
  },
  
  // Couch colors
  couch: {
    body: '#7c3aed',
    cushion: '#8b5cf6',
    border: '#6d28d9',
  },
  
  // Zone colors by type
  zones: {
    engineering: { fill: '#e3f2fd', stroke: '#2196f3' },
    product: { fill: '#e0f7fa', stroke: '#00bcd4' },
    design: { fill: '#fce4ec', stroke: '#e91e63' },
    sales: { fill: '#e8f5e9', stroke: '#4caf50' },
    marketing: { fill: '#fff3e0', stroke: '#ff9800' },
    operations: { fill: '#fff8e1', stroke: '#ffc107' },
    leadership: { fill: '#ede7f6', stroke: '#673ab7' },
    hr: { fill: '#fce4ec', stroke: '#e91e63' },
    finance: { fill: '#c8e6c9', stroke: '#4caf50' },
    support: { fill: '#bbdefb', stroke: '#2196f3' },
    work: { fill: '#e3f2fd', stroke: '#2196f3' },
    meeting: { fill: '#e8f5e9', stroke: '#4caf50' },
    break: { fill: '#fff3e0', stroke: '#ff9800' },
    focus: { fill: '#f3e5f5', stroke: '#9c27b0' },
    social: { fill: '#fffde7', stroke: '#ffc107' },
    collaboration: { fill: '#e0f2f1', stroke: '#009688' },
    creative: { fill: '#fce4ec', stroke: '#e91e63' },
    reception: { fill: '#e0f7fa', stroke: '#00bcd4' },
    executive: { fill: '#ede7f6', stroke: '#673ab7' },
  },
  
  // Room colors by type
  rooms: {
    meeting: { fill: '#c8e6c9', stroke: '#4caf50' },
    break: { fill: '#ffe0b2', stroke: '#ff9800' },
    phone: { fill: '#bbdefb', stroke: '#2196f3' },
    'phone-booth': { fill: '#bbdefb', stroke: '#2196f3' },
    private: { fill: '#e1bee7', stroke: '#9c27b0' },
    conference: { fill: '#c5cae9', stroke: '#3f51b5' },
    huddle: { fill: '#f8bbd0', stroke: '#e91e63' },
    focus: { fill: '#fff3e0', stroke: '#ff9800' },
  },
  
  // Hot desk indicator
  hotDesk: {
    fill: '#fbbf24',
    stroke: '#f59e0b',
  },
  
  // Spawn point
  spawn: {
    fill: '#4caf50',
    fillOpacity: 0.3,
    stroke: '#4caf50',
  },
} as const;

// =============================================================================
// DIMENSIONS
// =============================================================================

export const OFFICE_DIMENSIONS = {
  desk: {
    width: 60,
    height: 40,
  },
  chair: {
    width: 24,
    height: 20,
    offset: 16, // Distance from desk
  },
  monitor: {
    width: 16,
    height: 10,
    standWidth: 6,
    standHeight: 4,
  },
  keyboard: {
    width: 20,
    height: 6,
  },
  plant: {
    potWidth: 20,
    potHeight: 18,
    leafRadius: 14,
  },
  whiteboard: {
    width: 70,
    height: 45,
    trayHeight: 4,
  },
  coffeeMachine: {
    width: 24,
    height: 40,
  },
  couch: {
    width: 70,
    height: 30,
    armWidth: 8,
  },
  conferenceTable: {
    widthRatio: 0.7,
    heightRatio: 0.35,
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert hex color to Phaser number format
 */
export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/**
 * Get zone color by type
 */
export function getZoneColor(type: string): { fill: string; stroke: string } {
  return OFFICE_COLORS.zones[type as keyof typeof OFFICE_COLORS.zones] 
    || OFFICE_COLORS.zones.work;
}

/**
 * Get room color by type
 */
export function getRoomColor(type: string): { fill: string; stroke: string } {
  return OFFICE_COLORS.rooms[type as keyof typeof OFFICE_COLORS.rooms] 
    || OFFICE_COLORS.rooms.meeting;
}

// =============================================================================
// SVG PATH GENERATORS (for LayoutPreview)
// =============================================================================

export const SVG_PATHS = {
  /**
   * Generate SVG elements for a desk with monitor and keyboard
   */
  desk: (x: number, y: number, width: number = 60, height: number = 40) => {
    const monitorX = x + width / 2 - 8;
    const monitorY = y + 6;
    const keyboardX = x + width / 2 - 10;
    const keyboardY = y + height - 12;
    
    return {
      body: { x, y, width, height, rx: 3 },
      surface: { x: x + 2, y: y + 2, width: width - 4, height: height - 4, rx: 2 },
      monitor: { x: monitorX, y: monitorY, width: 16, height: 10, rx: 1 },
      monitorStand: { x: x + width / 2 - 3, y: monitorY + 10, width: 6, height: 4 },
      keyboard: { x: keyboardX, y: keyboardY, width: 20, height: 6, rx: 1 },
    };
  },
  
  /**
   * Generate SVG elements for a chair
   */
  chair: (x: number, y: number) => {
    return {
      seat: { cx: x, cy: y, rx: 12, ry: 10 },
      back: { x: x - 10, y: y + 4, width: 20, height: 8, rx: 3 },
    };
  },
  
  /**
   * Generate SVG elements for a plant
   */
plant: (x: number, y: number) => {
  return {
    // Pot body
    pot: `
      M${x - 14} ${y + 6}
      L${x - 10} ${y + 26}
      Q${x} ${y + 30} ${x + 10} ${y + 26}
      L${x + 14} ${y + 6}
      Z
    `,

    // Pot rim
    rim: `
      M${x - 16} ${y + 6}
      L${x + 16} ${y + 6}
      L${x + 14} ${y + 10}
      L${x - 14} ${y + 10}
      Z
    `,

    // Stem
    stem: `
      M${x} ${y + 6}
      C${x - 2} ${y - 2}, ${x - 1} ${y - 10}, ${x} ${y - 18}
    `,

    // Leaves (ellipses)
    leaves: [
      { cx: x - 10, cy: y - 6, rx: 10, ry: 6, rotate: -25 },
      { cx: x + 10, cy: y - 6, rx: 10, ry: 6, rotate: 25 },
      { cx: x - 4, cy: y - 14, rx: 8, ry: 12, rotate: -10 },
      { cx: x + 4, cy: y - 14, rx: 8, ry: 12, rotate: 10 },
      { cx: x, cy: y - 22, rx: 6, ry: 10, rotate: 0 },
    ],

    // Ground shadow
    shadow: {
      cx: x,
      cy: y + 30,
      rx: 18,
      ry: 4,
    },
  };
},

  
  /**
   * Generate SVG elements for a whiteboard
   */
  whiteboard: (x: number, y: number) => {
    const w = 70, h = 45;
    return {
      frame: { x: x - w/2, y: y - h/2, width: w, height: h, rx: 2 },
      surface: { x: x - w/2 + 5, y: y - h/2 + 5, width: w - 10, height: h - 10 },
      tray: { x: x - 25, y: y + h/2 - 5, width: 50, height: 4 },
    };
  },
  
  /**
   * Generate SVG elements for a coffee machine
   */
  coffeeMachine: (x: number, y: number) => {
    return {
      body: { x: x - 12, y: y - 20, width: 24, height: 40, rx: 3 },
      panel: { x: x - 8, y: y - 15, width: 16, height: 10, rx: 2 },
      indicator: { cx: x, cy: y + 5, r: 5 },
    };
  },
  
  /**
   * Generate SVG elements for a couch
   */
  couch: (x: number, y: number) => {
    const w = 70, h = 30;
    return {
      body: { x: x - w/2, y: y - h/2, width: w, height: h, rx: 6 },
      cushion: { x: x - w/2 + 5, y: y - h/2 + 4, width: w - 10, height: h - 12, rx: 4 },
      leftArm: { x: x - w/2 - 4, y: y - h/2 + 2, width: 8, height: h - 4, rx: 3 },
      rightArm: { x: x + w/2 - 4, y: y - h/2 + 2, width: 8, height: h - 4, rx: 3 },
    };
  },
  
  /**
   * Generate SVG elements for a conference table with chairs
   */
  conferenceTable: (roomX: number, roomY: number, roomWidth: number, roomHeight: number) => {
    const tableWidth = roomWidth * 0.7;
    const tableHeight = roomHeight * 0.35;
    const tableX = roomX + (roomWidth - tableWidth) / 2;
    const tableY = roomY + roomHeight * 0.35;
    
    const chairs = [0.25, 0.5, 0.75].flatMap(pos => [
      { cx: roomX + roomWidth * pos, cy: roomY + roomHeight * 0.28, position: 'top' },
      { cx: roomX + roomWidth * pos, cy: roomY + roomHeight * 0.78, position: 'bottom' },
    ]);
    
    return {
      table: { x: tableX, y: tableY, width: tableWidth, height: tableHeight, rx: 4 },
      chairs,
    };
  },
};

// =============================================================================
// PHASER COLOR MAPPINGS (for OfficeBuilder)
// =============================================================================

export const PHASER_COLORS = {
  floor: hexToNumber(OFFICE_COLORS.floor.wood.primary),
  floorGrid: hexToNumber(OFFICE_COLORS.floor.wood.line),
  wall: hexToNumber(OFFICE_COLORS.wall.primary),
  wallDark: hexToNumber(OFFICE_COLORS.wall.secondary),
  desk: hexToNumber(OFFICE_COLORS.desk.body),
  deskTop: hexToNumber(OFFICE_COLORS.desk.surface),
  chair: hexToNumber(OFFICE_COLORS.chair.seat),
  chairBorder: hexToNumber(OFFICE_COLORS.chair.border),
  plant: hexToNumber(OFFICE_COLORS.plant.leaf1),
  pot: hexToNumber(OFFICE_COLORS.plant.pot),
  whiteboard: hexToNumber(OFFICE_COLORS.whiteboard.surface),
  whiteboardFrame: hexToNumber(OFFICE_COLORS.whiteboard.frame),
  coffeeMachine: hexToNumber(OFFICE_COLORS.coffeeMachine.body),
  couch: hexToNumber(OFFICE_COLORS.couch.body),
  couchCushion: hexToNumber(OFFICE_COLORS.couch.cushion),
  monitor: hexToNumber(OFFICE_COLORS.monitor.frame),
  monitorScreen: hexToNumber(OFFICE_COLORS.monitor.screen),
};
