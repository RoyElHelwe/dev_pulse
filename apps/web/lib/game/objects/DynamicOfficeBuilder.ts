/**
 * Dynamic Office Builder
 * 
 * Renders office layouts from the generation system using tileset sprites.
 * Supports real-time layout updates, zone highlighting, and interactive elements.
 */

import * as Phaser from 'phaser';
import { GAME_CONFIG } from '../constants';
import { 
  OfficeLayoutData, 
  ZoneData, 
  DeskData, 
  RoomData, 
  DecorationData,
  WallData,
  SpawnPoint,
  ZoneType,
  DeskType,
  RoomType 
} from '../generators/types';
import { 
  TILESET_CONFIG, 
  ZONE_TILE_PALETTES, 
  ZONE_OVERLAYS,
  TILE_FRAMES 
} from '../assets/tileset-config';

export interface DynamicOfficeConfig {
  layout: OfficeLayoutData;
  showGrid?: boolean;
  showZoneOverlays?: boolean;
  interactiveMode?: boolean;
  onDeskClick?: (desk: DeskData) => void;
  onRoomClick?: (room: RoomData) => void;
  onEmptyClick?: (x: number, y: number) => void;
}

interface LayerContainers {
  floor: Phaser.GameObjects.Container;
  walls: Phaser.GameObjects.Container;
  furniture: Phaser.GameObjects.Container;
  decorations: Phaser.GameObjects.Container;
  overlays: Phaser.GameObjects.Container;
  ui: Phaser.GameObjects.Container;
}

export class DynamicOfficeBuilder {
  private scene: Phaser.Scene;
  private config: DynamicOfficeConfig;
  private layers!: LayerContainers;
  private graphics!: Phaser.GameObjects.Graphics;
  private collisionBodies: Phaser.GameObjects.Rectangle[] = [];
  
  // Tileset loaded flag
  private tilesetsLoaded: boolean = false;
  
  // Interactive elements registry
  private interactiveDesks: Map<string, Phaser.GameObjects.Container> = new Map();
  private interactiveRooms: Map<string, Phaser.GameObjects.Container> = new Map();
  
  constructor(scene: Phaser.Scene, config: DynamicOfficeConfig) {
    this.scene = scene;
    this.config = {
      showGrid: false,
      showZoneOverlays: false,
      interactiveMode: false,
      ...config,
    };
  }
  
  /**
   * Preload tileset assets - call in scene preload()
   */
  public static preloadAssets(scene: Phaser.Scene): void {
    // Load main tileset spritesheet
    scene.load.spritesheet(
      TILESET_CONFIG.mainTileset.key,
      TILESET_CONFIG.mainTileset.path,
      {
        frameWidth: TILESET_CONFIG.mainTileset.frameWidth,
        frameHeight: TILESET_CONFIG.mainTileset.frameHeight,
      }
    );
    
    // Load room builder tileset
    scene.load.spritesheet(
      TILESET_CONFIG.roomBuilder.key,
      TILESET_CONFIG.roomBuilder.path,
      {
        frameWidth: TILESET_CONFIG.roomBuilder.frameWidth,
        frameHeight: TILESET_CONFIG.roomBuilder.frameHeight,
      }
    );
    
    // Preload individual sprites for key furniture (optional - for higher quality)
    // This can be expanded based on needs
    const singlesPath = TILESET_CONFIG.singlesPath;
    const prefix = TILESET_CONFIG.singlesPrefix;
    
    // Load a subset of single sprites for key items
    const keySprites = [1, 2, 3, 20, 21, 40, 100, 101, 120, 140, 160];
    keySprites.forEach(num => {
      scene.load.image(
        `office-single-${num}`,
        `${singlesPath}/${prefix}${num}.png`
      );
    });
  }
  
  /**
   * Build the complete office from layout data
   */
  public build(): void {
    this.initializeLayers();
    this.graphics = this.scene.add.graphics();
    
    const { layout } = this.config;
    
    // Get dimensions - support both formats
    const width = layout.dimensions?.width ?? (layout as any).width ?? 1600;
    const height = layout.dimensions?.height ?? (layout as any).height ?? 900;
    
    // Set up physics world bounds
    this.scene.physics.world.setBounds(0, 0, width, height);
    
    // Store dimensions for later use
    (this as any)._layoutWidth = width;
    (this as any)._layoutHeight = height;
    
    // Render each layer in order
    this.renderFloor();
    this.renderZones();
    this.renderWalls();
    this.renderRooms();
    this.renderDesks();
    this.renderDecorations();
    
    // Optional overlays
    if (this.config.showGrid) {
      this.renderGrid();
    }
    
    if (this.config.showZoneOverlays) {
      this.renderZoneOverlays();
    }
    
    // Setup interactivity if enabled
    if (this.config.interactiveMode) {
      this.setupInteractivity();
    }
  }
  
  /**
   * Initialize layer containers for proper z-ordering
   */
  private initializeLayers(): void {
    this.layers = {
      floor: this.scene.add.container(0, 0),
      walls: this.scene.add.container(0, 0),
      furniture: this.scene.add.container(0, 0),
      decorations: this.scene.add.container(0, 0),
      overlays: this.scene.add.container(0, 0),
      ui: this.scene.add.container(0, 0),
    };
    
    // Set depth ordering
    this.layers.floor.setDepth(0);
    this.layers.walls.setDepth(10);
    this.layers.furniture.setDepth(20);
    this.layers.decorations.setDepth(30);
    this.layers.overlays.setDepth(40);
    this.layers.ui.setDepth(100);
  }
  
  /**
   * Get layout dimensions - supports both formats
   */
  private getLayoutDimensions(): { width: number; height: number } {
    const { layout } = this.config;
    return {
      width: layout.dimensions?.width ?? (layout as any).width ?? 1600,
      height: layout.dimensions?.height ?? (layout as any).height ?? 900,
    };
  }
  
  /**
   * Render the base floor
   */
  private renderFloor(): void {
    const { TILE_SIZE } = GAME_CONFIG;
    const { width, height } = this.getLayoutDimensions();
    
    // Create floor graphics
    const floorGraphics = this.scene.add.graphics();
    
    // Base floor color
    floorGraphics.fillStyle(0xf5f5dc, 1); // Beige base
    floorGraphics.fillRect(0, 0, width, height);
    
    // Attempt to use tileset if loaded
    if (this.scene.textures.exists(TILESET_CONFIG.mainTileset.key)) {
      this.tilesetsLoaded = true;
      this.renderTiledFloor();
    } else {
      // Fallback to grid pattern
      floorGraphics.lineStyle(1, 0xe5e5c5, 0.5);
      
      for (let x = 0; x <= width; x += TILE_SIZE) {
        floorGraphics.lineBetween(x, 0, x, height);
      }
      
      for (let y = 0; y <= height; y += TILE_SIZE) {
        floorGraphics.lineBetween(0, y, width, y);
      }
    }
    
    this.layers.floor.add(floorGraphics);
  }
  
  /**
   * Render floor using tileset sprites
   */
  private renderTiledFloor(): void {
    const { TILE_SIZE } = GAME_CONFIG;
    const { width, height } = this.getLayoutDimensions();
    const tilesetKey = TILESET_CONFIG.mainTileset.key;
    
    const tilesX = Math.ceil(width / TILE_SIZE);
    const tilesY = Math.ceil(height / TILE_SIZE);
    
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        // Default floor tile frame (vary for visual interest)
        const frameIndex = TILE_FRAMES.floors.wood.variants[
          (tx + ty) % TILE_FRAMES.floors.wood.variants.length
        ];
        
        const tile = this.scene.add.sprite(
          tx * TILE_SIZE + TILE_SIZE / 2,
          ty * TILE_SIZE + TILE_SIZE / 2,
          tilesetKey,
          frameIndex
        );
        
        this.layers.floor.add(tile);
      }
    }
  }
  
  /**
   * Render zone backgrounds
   */
  private renderZones(): void {
    const { layout } = this.config;
    const zoneGraphics = this.scene.add.graphics();
    
    layout.zones.forEach(zone => {
      const palette = (ZONE_TILE_PALETTES as Record<string, any>)[zone.type] || ZONE_TILE_PALETTES.work;
      const color = this.getZoneFloorColor(zone.type);
      
      // Normalize zone bounds - support both formats:
      // 1. { bounds: { x, y, width, height } } - template format
      // 2. { x, y, width, height } - legacy format
      const x = zone.bounds?.x ?? (zone as any).x ?? 0;
      const y = zone.bounds?.y ?? (zone as any).y ?? 0;
      const width = zone.bounds?.width ?? (zone as any).width ?? 100;
      const height = zone.bounds?.height ?? (zone as any).height ?? 100;
      
      // Zone floor
      zoneGraphics.fillStyle(color, 0.3);
      zoneGraphics.fillRect(x, y, width, height);
      
      // Zone border
      zoneGraphics.lineStyle(2, color, 0.5);
      zoneGraphics.strokeRect(x, y, width, height);
      
      // Zone label
      const label = this.scene.add.text(
        x + 10,
        y + 5,
        zone.name,
        {
          fontSize: '11px',
          fontFamily: 'Arial, sans-serif',
          color: '#666666',
          backgroundColor: 'rgba(255,255,255,0.7)',
          padding: { x: 4, y: 2 },
        }
      );
      this.layers.ui.add(label);
    });
    
    this.layers.floor.add(zoneGraphics);
  }
  
  /**
   * Get floor color for zone type
   */
  private getZoneFloorColor(zoneType: ZoneType | string): number {
    const colors: Record<string, number> = {
      work: 0xe3f2fd,
      meeting: 0xe8f5e9,
      break: 0xfff3e0,
      focus: 0xf3e5f5,
      social: 0xfffde7,
      creative: 0xfce4ec,
      reception: 0xe0f7fa,
      executive: 0xede7f6,
      // Additional zone types from templates
      engineering: 0xe3f2fd,
      product: 0xf3e5f5,
      collaboration: 0xede7f6,
      leadership: 0xf3e5f5,
      marketing: 0xfff3e0,
      sales: 0xe8f5e9,
      operations: 0xe0f7fa,
      hr: 0xfce4ec,
      finance: 0xe8eaf6,
      support: 0xfffde7,
      design: 0xfce4ec,
      research: 0xe3f2fd,
      quiet: 0xf5f5f5,
      lounge: 0xfff3e0,
      kitchen: 0xfffde7,
      lobby: 0xeceff1,
      'open-office': 0xe3f2fd,
      'private-office': 0xede7f6,
    };
    return colors[zoneType] || 0xf5f5f5;
  }
  
  /**
   * Render walls
   */
  private renderWalls(): void {
    const { layout } = this.config;
    const { TILE_SIZE, COLORS } = GAME_CONFIG;
    const { width, height } = this.getLayoutDimensions();
    
    const wallGraphics = this.scene.add.graphics();
    const wallThickness = TILE_SIZE;
    
    // Draw perimeter walls
    wallGraphics.fillStyle(COLORS.WALL, 1);
    
    // Top wall
    wallGraphics.fillRect(0, 0, width, wallThickness);
    // Bottom wall
    wallGraphics.fillRect(0, height - wallThickness, width, wallThickness);
    // Left wall
    wallGraphics.fillRect(0, 0, wallThickness, height);
    // Right wall
    wallGraphics.fillRect(width - wallThickness, 0, wallThickness, height);
    
    // Wall detail (darker top edge)
    wallGraphics.fillStyle(COLORS.WALL_DARK, 1);
    wallGraphics.fillRect(0, 0, width, 8);
    wallGraphics.fillRect(0, 0, 8, height);
    
    // Add wall collision bodies (x, y are CENTER coordinates for Phaser rectangles)
    this.addWallCollision(width / 2, wallThickness / 2, width, wallThickness); // Top
    this.addWallCollision(width / 2, height - wallThickness / 2, width, wallThickness); // Bottom
    this.addWallCollision(wallThickness / 2, height / 2, wallThickness, height); // Left
    this.addWallCollision(width - wallThickness / 2, height / 2, wallThickness, height); // Right
    
    // Interior walls from layout
    if (layout.walls) {
      layout.walls.forEach(wall => {
        this.renderWall(wallGraphics, wall);
      });
    }
    
    this.layers.walls.add(wallGraphics);
  }
  
  /**
   * Render a single wall segment
   * Uses format: { start, end, thickness }
   */
  private renderWall(graphics: Phaser.GameObjects.Graphics, wall: WallData): void {
    const { COLORS } = GAME_CONFIG;
    
    graphics.fillStyle(COLORS.WALL, 1);
    
    // Calculate dimensions from start and end points
    const startX = wall.start.x;
    const startY = wall.start.y;
    const endX = wall.end.x;
    const endY = wall.end.y;
    const thickness = wall.thickness || 32;
    
    // Determine if horizontal or vertical wall
    if (startY === endY) {
      // Horizontal wall
      const x = Math.min(startX, endX);
      const length = Math.abs(endX - startX);
      if (length > 0) {
        graphics.fillRect(x, startY, length, thickness);
        this.addWallCollision(x + length / 2, startY + thickness / 2, length, thickness);
      }
    } else if (startX === endX) {
      // Vertical wall
      const y = Math.min(startY, endY);
      const length = Math.abs(endY - startY);
      if (length > 0) {
        graphics.fillRect(startX, y, thickness, length);
        this.addWallCollision(startX + thickness / 2, y + length / 2, thickness, length);
      }
    } else {
      // Diagonal wall - draw as thick line
      graphics.lineStyle(thickness, COLORS.WALL, 1);
      graphics.lineBetween(startX, startY, endX, endY);
    }
    
    // Door opening
    if (wall.hasDoor && wall.doorPosition) {
      graphics.fillStyle(this.getZoneFloorColor('work'), 1);
      
      const doorX = wall.doorPosition.x;
      const doorY = wall.doorPosition.y;
      
      // Draw door opening (clear the wall at door position)
      if (startY === endY) {
        // Horizontal wall - door is vertical gap
        graphics.fillRect(doorX - 20, startY, 40, thickness);
      } else {
        // Vertical wall - door is horizontal gap
        graphics.fillRect(startX, doorY - 20, thickness, 40);
      }
    }
  }
  
  /**
   * Add wall collision body
   */
  private addWallCollision(x: number, y: number, width: number, height: number): void {
    const body = this.scene.add.rectangle(x, y, width, height, 0x000000, 0);
    this.scene.physics.add.existing(body, true);
    this.collisionBodies.push(body);
  }
  
  /**
   * Render rooms (meeting rooms, break rooms, etc.)
   */
  private renderRooms(): void {
    const { layout } = this.config;
    
    layout.rooms.forEach(room => {
      this.renderRoom(room);
    });
  }
  
  // Internal interface for normalized room data with direct x, y, width, height
  private renderRoom(room: RoomData & { x?: number; y?: number; width?: number; height?: number }): void {
    // Get room bounds - support both formats
    const x = room.bounds?.x ?? room.x ?? 0;
    const y = room.bounds?.y ?? room.y ?? 0;
    const width = room.bounds?.width ?? room.width ?? 100;
    const height = room.bounds?.height ?? room.height ?? 100;
    
    const container = this.scene.add.container(x, y);
    
    const colors = this.getRoomColors(room.type);
    const graphics = this.scene.add.graphics();
    
    // Room floor
    graphics.fillStyle(colors.fill, 1);
    graphics.fillRect(0, 0, width, height);
    
    // Room border/walls
    graphics.lineStyle(4, colors.border, 1);
    graphics.strokeRect(0, 0, width, height);
    
    container.add(graphics);
    
    // Room label
    const label = this.scene.add.text(
      width / 2,
      12,
      room.name,
      {
        fontSize: '13px',
        fontFamily: 'Arial, sans-serif',
        color: '#333333',
        fontStyle: 'bold',
      }
    );
    label.setOrigin(0.5, 0);
    container.add(label);
    
    // Room-specific furniture - pass dimensions
    this.renderRoomFurniture(container, room, width, height);
    
    this.layers.furniture.add(container);
    
    // Store for interactivity
    if (this.config.interactiveMode) {
      this.interactiveRooms.set(room.id, container);
    }
  }
  
  /**
   * Get colors for room type
   */
  private getRoomColors(type: RoomType | string): { fill: number; border: number } {
    const colorMap: Record<string, { fill: number; border: number }> = {
      meeting: { fill: 0xe8f5e9, border: 0x4caf50 },
      break: { fill: 0xfff3e0, border: 0xff9800 },
      phone: { fill: 0xe3f2fd, border: 0x2196f3 },
      private: { fill: 0xf3e5f5, border: 0x9c27b0 },
      conference: { fill: 0xe8eaf6, border: 0x3f51b5 },
      huddle: { fill: 0xfce4ec, border: 0xe91e63 },
      // Additional room types from templates
      'phone-booth': { fill: 0xfce4ec, border: 0xe91e63 },
      focus: { fill: 0xeceff1, border: 0x607d8b },
      executive: { fill: 0xede7f6, border: 0x673ab7 },
      boardroom: { fill: 0xe8eaf6, border: 0x3f51b5 },
      training: { fill: 0xe3f2fd, border: 0x2196f3 },
      lounge: { fill: 0xfff3e0, border: 0xff9800 },
      kitchen: { fill: 0xfffde7, border: 0xffc107 },
      reception: { fill: 0xe0f7fa, border: 0x00bcd4 },
      storage: { fill: 0xfafafa, border: 0x9e9e9e },
    };
    return colorMap[type] || { fill: 0xf5f5f5, border: 0x9e9e9e };
  }
  
  /**
   * Render furniture inside a room
   */
  private renderRoomFurniture(container: Phaser.GameObjects.Container, room: RoomData, roomWidth: number, roomHeight: number): void {
    const graphics = this.scene.add.graphics();
    const { COLORS } = GAME_CONFIG;
    
    if (room.type === 'meeting' || room.type === 'conference') {
      // Conference table
      const tableWidth = roomWidth * 0.6;
      const tableHeight = roomHeight * 0.35;
      const tableX = (roomWidth - tableWidth) / 2;
      const tableY = (roomHeight - tableHeight) / 2 + 15;
      
      graphics.fillStyle(COLORS.DESK, 1);
      graphics.fillRoundedRect(tableX, tableY, tableWidth, tableHeight, 6);
      graphics.fillStyle(COLORS.DESK_TOP, 1);
      graphics.fillRoundedRect(tableX + 3, tableY + 3, tableWidth - 6, tableHeight - 6, 4);
      
      // Chairs around table
      const chairSize = 18;
      const chairs = this.calculateChairPositions(tableX, tableY, tableWidth, tableHeight, room.capacity || 6);
      chairs.forEach(pos => {
        graphics.fillStyle(COLORS.CHAIR, 1);
        graphics.fillRoundedRect(pos.x - chairSize / 2, pos.y - chairSize / 2, chairSize, chairSize, 3);
      });
      
    } else if (room.type === 'break') {
      // Couch
      graphics.fillStyle(0x6b5b95, 1);
      graphics.fillRoundedRect(20, roomHeight - 70, 90, 45, 6);
      graphics.fillStyle(0x7d6ba0, 1);
      graphics.fillRoundedRect(25, roomHeight - 65, 80, 32, 4);
      
      // Coffee table
      graphics.fillStyle(COLORS.DESK, 1);
      graphics.fillRoundedRect(120, roomHeight - 55, 50, 25, 3);
      
      // Coffee machine
      graphics.fillStyle(COLORS.COFFEE_MACHINE, 1);
      graphics.fillRect(roomWidth - 50, 35, 35, 45);
      
    } else if (room.type === 'phone' || room.type === 'phone-booth' || room.type === 'huddle') {
      // Small table
      const tableSize = Math.min(roomWidth, roomHeight) * 0.4;
      graphics.fillStyle(COLORS.DESK, 1);
      graphics.fillRoundedRect(
        (roomWidth - tableSize) / 2,
        (roomHeight - tableSize) / 2 + 10,
        tableSize,
        tableSize,
        4
      );
      
      // Single chair
      graphics.fillStyle(COLORS.CHAIR, 1);
      graphics.fillRoundedRect(
        (roomWidth - 20) / 2,
        roomHeight - 35,
        20,
        20,
        4
      );
    } else if (room.type === 'focus') {
      // Focus room - small desk and chair
      const deskWidth = roomWidth * 0.5;
      const deskHeight = roomHeight * 0.25;
      graphics.fillStyle(COLORS.DESK, 1);
      graphics.fillRoundedRect(
        (roomWidth - deskWidth) / 2,
        20,
        deskWidth,
        deskHeight,
        4
      );
      
      // Chair
      graphics.fillStyle(COLORS.CHAIR, 1);
      graphics.fillRoundedRect(
        (roomWidth - 18) / 2,
        20 + deskHeight + 10,
        18,
        18,
        4
      );
    }
    
    container.add(graphics);
  }
  
  /**
   * Calculate chair positions around a table
   */
  private calculateChairPositions(
    tableX: number, 
    tableY: number, 
    tableWidth: number, 
    tableHeight: number,
    count: number
  ): Array<{ x: number; y: number }> {
    const positions: Array<{ x: number; y: number }> = [];
    const topBottomCount = Math.floor(count / 2);
    
    // Top row
    for (let i = 0; i < topBottomCount; i++) {
      positions.push({
        x: tableX + tableWidth * (i + 1) / (topBottomCount + 1),
        y: tableY - 15,
      });
    }
    
    // Bottom row
    for (let i = 0; i < topBottomCount; i++) {
      positions.push({
        x: tableX + tableWidth * (i + 1) / (topBottomCount + 1),
        y: tableY + tableHeight + 15,
      });
    }
    
    return positions;
  }
  
  /**
   * Render all desks from layout
   */
  private renderDesks(): void {
    const { layout } = this.config;
    
    layout.desks.forEach(desk => {
      this.renderDesk(desk);
    });
  }
  
  /**
   * Render a single desk
   */
  private renderDesk(desk: DeskData): void {
    // Get position and dimensions - DeskData uses position and dimensions objects
    const x = desk.position.x;
    const y = desk.position.y;
    const width = desk.dimensions?.width ?? 80;
    const height = desk.dimensions?.height ?? 50;
    
    const container = this.scene.add.container(x, y);
    const graphics = this.scene.add.graphics();
    const { COLORS } = GAME_CONFIG;
    
    // Desk style based on type
    const deskColors = this.getDeskColors(desk.type);
    
    // Desk body
    graphics.fillStyle(deskColors.body, 1);
    graphics.fillRoundedRect(0, 0, width, height, 4);
    
    // Desk top surface
    graphics.fillStyle(deskColors.top, 1);
    graphics.fillRoundedRect(3, 3, width - 6, height - 6, 3);
    
    // Computer monitor
    const monitorWidth = 22;
    const monitorHeight = 16;
    const monitorX = width / 2 - monitorWidth / 2;
    const monitorY = 7;
    
    graphics.fillStyle(0x333333, 1);
    graphics.fillRoundedRect(monitorX, monitorY, monitorWidth, monitorHeight, 2);
    graphics.fillStyle(0x4fc3f7, 1);
    graphics.fillRect(monitorX + 2, monitorY + 2, monitorWidth - 4, monitorHeight - 4);
    
    // Monitor stand
    graphics.fillStyle(0x333333, 1);
    graphics.fillRect(monitorX + monitorWidth / 2 - 3, monitorY + monitorHeight, 6, 4);
    
    container.add(graphics);
    
    // Chair
    const chairGraphics = this.scene.add.graphics();
    const chairX = width / 2 - 11;
    const chairY = height + 6;
    
    chairGraphics.fillStyle(COLORS.CHAIR, 1);
    chairGraphics.fillRoundedRect(chairX, chairY, 22, 22, 4);
    chairGraphics.fillStyle(0x1e40af, 1);
    chairGraphics.fillRoundedRect(chairX + 3, chairY + 3, 16, 16, 3);
    
    container.add(chairGraphics);
    
    // Desk label (for assigned desks)
    if (desk.assignedTo) {
      const label = this.scene.add.text(
        width / 2,
        height + 32,
        desk.assignedTo.slice(0, 10),
        {
          fontSize: '9px',
          fontFamily: 'Arial, sans-serif',
          color: '#666666',
        }
      );
      label.setOrigin(0.5, 0);
      container.add(label);
    }
    
    // Hot desk indicator
    if (desk.type === 'hot') {
      const indicator = this.scene.add.graphics();
      indicator.fillStyle(0xf1c40f, 1);
      indicator.fillCircle(width - 8, 8, 5);
      container.add(indicator);
    }
    
    this.layers.furniture.add(container);
    
    // Store for interactivity
    if (this.config.interactiveMode) {
      this.interactiveDesks.set(desk.id, container);
      this.setupDeskInteraction(container, desk, width, height);
    }
    
    // Add collision (smaller than visual to allow walking near)
    const collisionBody = this.scene.add.rectangle(
      x + width / 2,
      y + height / 2,
      width - 10,
      height - 10,
      0x000000,
      0
    );
    this.scene.physics.add.existing(collisionBody, true);
    this.collisionBodies.push(collisionBody);
  }
  
  /**
   * Get desk colors based on type
   */
  private getDeskColors(type?: DeskType): { body: number; top: number } {
    const { COLORS } = GAME_CONFIG;
    
    const colorMap: Record<string, { body: number; top: number }> = {
      standard: { body: COLORS.DESK, top: COLORS.DESK_TOP },
      standing: { body: 0x5d4037, top: 0xbcaaa4 },
      executive: { body: 0x3e2723, top: 0x8d6e63 },
      hot: { body: 0x37474f, top: 0x90a4ae },
      hotdesk: { body: 0x37474f, top: 0x90a4ae },
      'l-shaped': { body: COLORS.DESK, top: COLORS.DESK_TOP },
    };
    
    return colorMap[type || 'standard'] || colorMap.standard;
  }
  
  /**
   * Setup desk click interaction
   */
  private setupDeskInteraction(
    container: Phaser.GameObjects.Container, 
    desk: DeskData,
    width: number,
    height: number
  ): void {
    const hitArea = this.scene.add.rectangle(
      width / 2,
      height / 2 + 15,
      width + 10,
      height + 35,
      0x000000,
      0
    );
    hitArea.setInteractive({ useHandCursor: true });
    
    hitArea.on('pointerover', () => {
      container.setScale(1.05);
    });
    
    hitArea.on('pointerout', () => {
      container.setScale(1);
    });
    
    hitArea.on('pointerdown', () => {
      if (this.config.onDeskClick) {
        this.config.onDeskClick(desk);
      }
    });
    
    container.add(hitArea);
  }
  
  /**
   * Render decorations
   */
  private renderDecorations(): void {
    const { layout } = this.config;
    
    layout.decorations.forEach(decoration => {
      this.renderDecoration(decoration);
    });
  }
  
  /**
   * Render a single decoration
   */
  private renderDecoration(decoration: DecorationData): void {
    const graphics = this.scene.add.graphics();
    const { COLORS } = GAME_CONFIG;
    
    // Get position - DecorationData uses position object
    const x = decoration.position.x;
    const y = decoration.position.y;
    
    // Get dimensions from decoration or use defaults
    const width = decoration.dimensions?.width ?? 32;
    const height = decoration.dimensions?.height ?? 32;
    
    switch (decoration.type) {
      case 'plant':
      case 'plant-large':
        this.drawPlant(graphics, x, y, 1.2);
        break;
      case 'plant-medium':
        this.drawPlant(graphics, x, y, 1.0);
        break;
      case 'plant-small':
        this.drawPlant(graphics, x, y, 0.7);
        break;
      case 'whiteboard':
        this.drawWhiteboard(graphics, x, y, width, height);
        break;
      case 'coffeeMachine':
      case 'coffee-machine':
        this.drawCoffeeMachine(graphics, x, y);
        break;
      case 'couch':
        this.drawCouch(graphics, x, y, width, height, decoration.rotation || 0);
        break;
      case 'bean-bag':
        this.drawBeanBag(graphics, x, y);
        break;
      case 'lamp':
        this.drawLamp(graphics, x, y);
        break;
      case 'bookshelf':
        this.drawBookshelf(graphics, x, y);
        break;
      case 'fridge':
        this.drawFridge(graphics, x, y);
        break;
      case 'conference-table':
        this.drawConferenceTable(graphics, x, y, width, height);
        break;
      case 'lounge-chair':
        this.drawLoungeChair(graphics, x, y);
        break;
      case 'coffee-table':
        this.drawCoffeeTable(graphics, x, y);
        break;
      case 'projector':
        this.drawProjector(graphics, x, y);
        break;
      case 'tv-screen':
        this.drawTvScreen(graphics, x, y);
        break;
      case 'printer':
        this.drawPrinter(graphics, x, y);
        break;
      case 'filing-cabinet':
        this.drawFilingCabinet(graphics, x, y);
        break;
      case 'water-cooler':
        this.drawWaterCooler(graphics, x, y);
        break;
      default:
        // Generic decoration - draw a simple marker with the type as text
        graphics.fillStyle(0x9e9e9e, 1);
        graphics.fillRoundedRect(x - 15, y - 15, 30, 30, 4);
    }
    
    this.layers.decorations.add(graphics);
  }
  
  private drawPlant(graphics: Phaser.GameObjects.Graphics, x: number, y: number, scale: number = 1): void {
    const { COLORS } = GAME_CONFIG;
    const s = scale;
    
    // Pot
    graphics.fillStyle(0xd2691e, 1);
    graphics.fillRect(x - 10 * s, y + 8 * s, 20 * s, 16 * s);
    graphics.fillStyle(0xcd853f, 1);
    graphics.fillRect(x - 13 * s, y + 6 * s, 26 * s, 5 * s);
    
    // Leaves
    graphics.fillStyle(COLORS.PLANT, 1);
    graphics.fillCircle(x, y - 4 * s, 12 * s);
    graphics.fillCircle(x - 8 * s, y, 8 * s);
    graphics.fillCircle(x + 8 * s, y, 8 * s);
    graphics.fillCircle(x, y + 4 * s, 10 * s);
  }
  
  private drawWhiteboard(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number = 100, height: number = 70): void {
    const { COLORS } = GAME_CONFIG;
    
    // Frame
    graphics.fillStyle(COLORS.WHITEBOARD_BORDER, 1);
    graphics.fillRect(x, y, width, height);
    
    // White surface
    graphics.fillStyle(COLORS.WHITEBOARD, 1);
    graphics.fillRect(x + 4, y + 4, width - 8, height - 8);
    
    // Content lines (proportional)
    graphics.lineStyle(2, 0x333333, 0.3);
    const lineSpacing = (height - 20) / 3;
    for (let i = 0; i < 3; i++) {
      const lineWidth = width - 20 - (i % 2) * 20;
      graphics.lineBetween(x + 12, y + 18 + i * lineSpacing, x + 12 + lineWidth, y + 18 + i * lineSpacing);
    }
    
    // Marker tray
    graphics.fillStyle(0x9e9e9e, 1);
    graphics.fillRect(x + 8, y + height - 2, width - 16, 7);
    
    // Markers
    [0xff0000, 0x0000ff, 0x00aa00, 0x000000].forEach((color, i) => {
      graphics.fillStyle(color, 1);
      graphics.fillRect(x + 16 + i * 18, y + height, 7, 5);
    });
  }
  
  private drawCoffeeMachine(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    graphics.fillStyle(0x5d4037, 1);
    graphics.fillRect(x, y, 35, 45);
    graphics.fillStyle(0x8d6e63, 1);
    graphics.fillRect(x + 5, y + 10, 25, 25);
    graphics.fillStyle(0x3e2723, 1);
    graphics.fillRect(x + 10, y + 38, 15, 5);
  }
  
  private drawCouch(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number = 85, height: number = 40, rotation: number = 0): void {
    // For now, handle basic rotation by swapping width/height for 90 degree
    const w = rotation === 90 || rotation === 270 ? height : width;
    const h = rotation === 90 || rotation === 270 ? width : height;
    
    graphics.fillStyle(0x6b5b95, 1);
    graphics.fillRoundedRect(x, y, w, h, 6);
    graphics.fillStyle(0x7d6ba0, 1);
    graphics.fillRoundedRect(x + 5, y + 5, w - 10, h - 12, 4);
  }
  
  private drawLamp(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Base
    graphics.fillStyle(0x333333, 1);
    graphics.fillRect(x - 8, y + 25, 16, 5);
    
    // Pole
    graphics.fillStyle(0x666666, 1);
    graphics.fillRect(x - 2, y, 4, 25);
    
    // Shade
    graphics.fillStyle(0xffd54f, 1);
    graphics.fillTriangle(x - 12, y, x + 12, y, x, y - 20);
  }
  
  private drawBookshelf(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const width = 60;
    const height = 80;
    
    // Frame
    graphics.fillStyle(0x5d4037, 1);
    graphics.fillRect(x, y, width, height);
    
    // Shelves
    graphics.fillStyle(0x8d6e63, 1);
    for (let i = 0; i < 4; i++) {
      graphics.fillRect(x + 3, y + 3 + i * 20, width - 6, 3);
    }
    
    // Books (colored rectangles)
    const bookColors = [0x1565c0, 0xc62828, 0x2e7d32, 0xf9a825, 0x6a1b9a];
    for (let shelf = 0; shelf < 3; shelf++) {
      let bookX = x + 5;
      for (let i = 0; i < 5; i++) {
        const bookWidth = 6 + Math.random() * 4;
        graphics.fillStyle(bookColors[i % bookColors.length], 1);
        graphics.fillRect(bookX, y + 7 + shelf * 20, bookWidth, 13);
        bookX += bookWidth + 1;
      }
    }
  }
  
  private drawBeanBag(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Bean bag - soft, rounded cushion
    graphics.fillStyle(0xe91e63, 1);
    graphics.fillCircle(x, y, 22);
    graphics.fillStyle(0xf48fb1, 1);
    graphics.fillCircle(x - 4, y - 4, 14);
  }
  
  private drawFridge(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Fridge body
    graphics.fillStyle(0xeceff1, 1);
    graphics.fillRoundedRect(x, y, 40, 60, 4);
    // Door line
    graphics.lineStyle(2, 0xb0bec5, 1);
    graphics.lineBetween(x + 5, y + 25, x + 35, y + 25);
    // Handle
    graphics.fillStyle(0x90a4ae, 1);
    graphics.fillRect(x + 32, y + 30, 4, 12);
    graphics.fillRect(x + 32, y + 8, 4, 10);
  }
  
  private drawConferenceTable(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number = 160, height: number = 64): void {
    // Table top
    graphics.fillStyle(0x5d4037, 1);
    graphics.fillRoundedRect(x, y, width, height, 6);
    graphics.fillStyle(0x8d6e63, 1);
    graphics.fillRoundedRect(x + 4, y + 4, width - 8, height - 8, 4);
    
    // Chairs around the table
    const chairSize = 18;
    const chairColor = 0x1565c0;
    
    // Top and bottom chairs
    const chairsPerSide = Math.floor(width / 40);
    for (let i = 0; i < chairsPerSide; i++) {
      const chairX = x + 20 + i * ((width - 40) / (chairsPerSide - 1)) - chairSize / 2;
      // Top
      graphics.fillStyle(chairColor, 1);
      graphics.fillRoundedRect(chairX, y - chairSize - 4, chairSize, chairSize, 4);
      // Bottom
      graphics.fillRoundedRect(chairX, y + height + 4, chairSize, chairSize, 4);
    }
  }
  
  private drawLoungeChair(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Cushion
    graphics.fillStyle(0x5c6bc0, 1);
    graphics.fillRoundedRect(x, y, 36, 36, 8);
    graphics.fillStyle(0x7986cb, 1);
    graphics.fillRoundedRect(x + 4, y + 4, 28, 28, 6);
  }
  
  private drawCoffeeTable(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Table top
    graphics.fillStyle(0x5d4037, 1);
    graphics.fillRoundedRect(x, y, 50, 30, 4);
    graphics.fillStyle(0x795548, 1);
    graphics.fillRoundedRect(x + 3, y + 3, 44, 24, 3);
  }
  
  private drawProjector(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Projector body
    graphics.fillStyle(0x37474f, 1);
    graphics.fillRoundedRect(x, y, 35, 25, 4);
    // Lens
    graphics.fillStyle(0x00bcd4, 1);
    graphics.fillCircle(x + 10, y + 12, 6);
    // Light indicator
    graphics.fillStyle(0x4caf50, 1);
    graphics.fillCircle(x + 28, y + 8, 3);
  }
  
  private drawTvScreen(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Screen frame
    graphics.fillStyle(0x212121, 1);
    graphics.fillRect(x, y, 80, 50);
    // Screen
    graphics.fillStyle(0x42a5f5, 1);
    graphics.fillRect(x + 3, y + 3, 74, 44);
    // Stand
    graphics.fillStyle(0x424242, 1);
    graphics.fillRect(x + 35, y + 50, 10, 8);
    graphics.fillRect(x + 25, y + 56, 30, 4);
  }
  
  private drawPrinter(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Main body
    graphics.fillStyle(0x37474f, 1);
    graphics.fillRoundedRect(x, y, 50, 35, 4);
    // Paper tray top
    graphics.fillStyle(0xeceff1, 1);
    graphics.fillRect(x + 5, y - 3, 40, 8);
    // Output tray
    graphics.fillStyle(0x455a64, 1);
    graphics.fillRect(x + 8, y + 28, 34, 10);
  }
  
  private drawFilingCabinet(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Cabinet body
    graphics.fillStyle(0x607d8b, 1);
    graphics.fillRoundedRect(x, y, 40, 70, 4);
    // Drawers
    for (let i = 0; i < 3; i++) {
      graphics.fillStyle(0x78909c, 1);
      graphics.fillRoundedRect(x + 3, y + 5 + i * 22, 34, 18, 2);
      // Handle
      graphics.fillStyle(0x455a64, 1);
      graphics.fillRect(x + 15, y + 12 + i * 22, 10, 4);
    }
  }
  
  private drawWaterCooler(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    // Base
    graphics.fillStyle(0xeceff1, 1);
    graphics.fillRoundedRect(x, y + 30, 30, 40, 4);
    // Water bottle
    graphics.fillStyle(0x81d4fa, 0.7);
    graphics.fillRect(x + 5, y, 20, 35);
    graphics.fillStyle(0x29b6f6, 1);
    graphics.fillRect(x + 5, y + 20, 20, 15);
    // Tap
    graphics.fillStyle(0x90a4ae, 1);
    graphics.fillRect(x + 25, y + 40, 8, 6);
  }

  /**
   * Render grid overlay
   */
  private renderGrid(): void {
    const { TILE_SIZE } = GAME_CONFIG;
    const { width, height } = this.getLayoutDimensions();
    const graphics = this.scene.add.graphics();
    
    graphics.lineStyle(1, 0x000000, 0.1);
    
    for (let x = 0; x <= width; x += TILE_SIZE) {
      graphics.lineBetween(x, 0, x, height);
    }
    
    for (let y = 0; y <= height; y += TILE_SIZE) {
      graphics.lineBetween(0, y, width, y);
    }
    
    this.layers.overlays.add(graphics);
  }
  
  /**
   * Render zone overlay highlights
   */
  private renderZoneOverlays(): void {
    const { layout } = this.config;
    
    layout.zones.forEach(zone => {
      const overlay = this.scene.add.graphics();
      const color = (ZONE_OVERLAYS as Record<string, number>)[zone.type] || 0x999999;
      
      // Get zone bounds - support both formats
      const x = zone.bounds?.x ?? (zone as any).x ?? 0;
      const y = zone.bounds?.y ?? (zone as any).y ?? 0;
      const width = zone.bounds?.width ?? (zone as any).width ?? 100;
      const height = zone.bounds?.height ?? (zone as any).height ?? 100;
      
      overlay.fillStyle(color, 0.15);
      overlay.fillRect(x, y, width, height);
      
      overlay.lineStyle(3, color, 0.6);
      overlay.strokeRect(x, y, width, height);
      
      this.layers.overlays.add(overlay);
    });
  }
  
  /**
   * Setup global interactivity
   */
  private setupInteractivity(): void {
    // Click on empty space
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.config.onEmptyClick) {
        // Check if click is on empty space (not on desk or room)
        const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.config.onEmptyClick(worldPoint.x, worldPoint.y);
      }
    });
  }
  
  /**
   * Get collision bodies for player physics
   */
  public getCollisionBodies(): Phaser.GameObjects.Rectangle[] {
    return this.collisionBodies;
  }
  
  /**
   * Update a desk's appearance (e.g., when occupied)
   */
  public updateDesk(deskId: string, updates: Partial<DeskData>): void {
    const container = this.interactiveDesks.get(deskId);
    if (!container) return;
    
    // Find and update the desk in layout
    const desk = this.config.layout.desks.find(d => d.id === deskId);
    if (desk) {
      Object.assign(desk, updates);
      // Re-render desk (simplified - could be optimized)
      container.destroy();
      this.interactiveDesks.delete(deskId);
      this.renderDesk(desk);
    }
  }
  
  /**
   * Highlight a specific zone
   */
  public highlightZone(zoneId: string, highlight: boolean): void {
    const zone = this.config.layout.zones.find(z => z.id === zoneId);
    if (!zone) return;
    
    const highlightGraphics = this.scene.add.graphics();
    const color = (ZONE_OVERLAYS as Record<string, number>)[zone.type] || 0x999999;
    
    // Get zone bounds
    const x = zone.bounds?.x ?? (zone as any).x ?? 0;
    const y = zone.bounds?.y ?? (zone as any).y ?? 0;
    const width = zone.bounds?.width ?? (zone as any).width ?? 100;
    const height = zone.bounds?.height ?? (zone as any).height ?? 100;
    
    if (highlight) {
      highlightGraphics.fillStyle(color, 0.3);
      highlightGraphics.fillRect(x, y, width, height);
      highlightGraphics.lineStyle(4, color, 0.8);
      highlightGraphics.strokeRect(x, y, width, height);
    }
    
    this.layers.overlays.add(highlightGraphics);
  }
  
  /**
   * Get spawn point for player positioning
   * Supports both old format (spawnPoint) and new format (spawnPoints array)
   */
  public getSpawnPoint(): { x: number; y: number; direction?: string } {
    const { layout } = this.config;
    
    // New format: spawnPoints array
    if (layout.spawnPoints && layout.spawnPoints.length > 0) {
      const spawn = layout.spawnPoints[0];
      return {
        x: spawn.position?.x ?? (spawn as any).x ?? 400,
        y: spawn.position?.y ?? (spawn as any).y ?? 300,
        direction: (spawn as any).direction,
      };
    }
    
    // Old format: spawnPoint object
    if ((layout as any).spawnPoint) {
      const spawn = (layout as any).spawnPoint;
      return {
        x: spawn.x ?? 400,
        y: spawn.y ?? 300,
        direction: spawn.direction,
      };
    }
    
    // Default spawn point
    const { width, height } = this.getLayoutDimensions();
    return { x: width / 2, y: height / 2 };
  }
  
  /**
   * Get the layout dimensions
   */
  public getDimensions(): { width: number; height: number } {
    return this.getLayoutDimensions();
  }
  
  /**
   * Destroy all created objects
   */
  public destroy(): void {
    Object.values(this.layers).forEach(layer => layer.destroy());
    this.graphics.destroy();
    this.collisionBodies.forEach(body => body.destroy());
    this.interactiveDesks.clear();
    this.interactiveRooms.clear();
  }
}
