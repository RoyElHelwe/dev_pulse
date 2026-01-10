import * as Phaser from 'phaser'
import { GAME_CONFIG } from '../constants'
import { DecorationData, DeskData, RoomData } from '@dev-pulse/shared-types'

// TypeScript Interfaces - Exported for reusability
export interface Position {
  x: number
  y: number
}

export interface Dimensions {
  width: number
  height: number
}

export interface Bounds extends Position, Dimensions {}

export interface WallData {
  x?: number
  y?: number
  width?: number
  height?: number
  start?: Position
  end?: Position
  thickness?: number
}

export interface ZoneData {
  id?: string
  type: string
  x?: number
  y?: number
  width?: number
  height?: number
  bounds?: Bounds
}

export interface LayoutConfig {
  dimensions?: Dimensions
  width?: number
  height?: number
  walls?: WallData[]
  zones?: ZoneData[]
  rooms?: RoomData[]
  desks?: DeskData[]
  decorations?: DecorationData[]
}

export interface LayoutDataWrapper {
  layout?: LayoutConfig
}

export interface RoomColors {
  fill: number
  border: number
}

export class OfficeBuilder {
  private scene: Phaser.Scene
  private graphics: Phaser.GameObjects.Graphics
  private collisionBodies: Phaser.GameObjects.Rectangle[] = []
  private textObjects: Phaser.GameObjects.Text[] = []
  private layoutWidth: number = GAME_CONFIG.WIDTH
  private layoutHeight: number = GAME_CONFIG.HEIGHT
  private roomColorMap?: Record<string, RoomColors>
  private zoneColorMap?: Record<string, number>
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.graphics = scene.add.graphics()
  }

  /**
   * Validate bounds with optional context logging
   */
  private validateBounds(bounds: Partial<Bounds> | undefined | null, contextId?: string): boolean {
    if (!bounds || 
        typeof bounds.x !== 'number' || 
        typeof bounds.y !== 'number' || 
        typeof bounds.width !== 'number' || 
        typeof bounds.height !== 'number' ||
        bounds.width <= 0 || 
        bounds.height <= 0) {
      if (contextId) {
        console.warn(`Invalid bounds for ${contextId}`)
      }
      return false
    }
    return true
  }

  /**
   * Validate position coordinates
   */
  private validatePosition(x: any, y: any): boolean {
    return typeof x === 'number' && typeof y === 'number'
  }

  /**
   * Reset drawing state before rebuilding to avoid duplicate shapes/bodies.
   */
  private resetScene(): void {
    this.graphics.clear()
    this.collisionBodies.forEach(body => {
      const physicsBody = body.body as Phaser.Physics.Arcade.StaticBody | undefined
      physicsBody?.destroy()
      body.destroy()
    })
    this.collisionBodies = []
    this.textObjects.forEach(text => text.destroy())
    this.textObjects = []
  }
  
  /**
   * Add a collision body for walls
   */
  private addWallCollision(x: number, y: number, width: number, height: number): void {
    const body = this.scene.add.rectangle(x, y, width, height, 0x000000, 0)
    this.scene.physics.add.existing(body, true) // true = static body
    this.collisionBodies.push(body)
  }
  
  /**
   * Build and render the office layout.
   * Clears any existing graphics and collision bodies before rendering.
   * 
   * @param layoutData - Optional custom layout configuration from backend.
   *                     If not provided, uses DEFAULT_LAYOUTS from GAME_CONFIG.
   */
  public buildOffice(layoutData?: LayoutDataWrapper): void {
    // Clear any previous run so we do not stack graphics/colliders
    this.resetScene()

    // If custom layout data is provided from backend, use it
    if (layoutData?.layout) {
      this.buildFromLayoutData(layoutData.layout)
    } else {
      // Otherwise use default office layout
      this.drawFloor()
      this.drawWalls()
      this.drawMeetingRooms()
      this.drawBreakRoom()
      this.drawDesks()
      this.drawDecorations()
    }
  }
  
  private buildFromLayoutData(layout: LayoutConfig): void {
    // Validate layout data
    if (!layout || typeof layout !== 'object') {
      console.error('Invalid layout data provided, using default office')
      this.drawFloor()
      this.drawWalls()
      this.drawMeetingRooms()
      this.drawBreakRoom()
      this.drawDesks()
      this.drawDecorations()
      return
    }
    
    // Normalize and validate dimensions once
    this.layoutWidth = layout.dimensions?.width ?? layout.width ?? GAME_CONFIG.WIDTH
    this.layoutHeight = layout.dimensions?.height ?? layout.height ?? GAME_CONFIG.HEIGHT
    
    if (this.layoutWidth <= 0 || this.layoutHeight <= 0) {
      console.error('Invalid layout dimensions, using defaults')
      this.layoutWidth = GAME_CONFIG.WIDTH
      this.layoutHeight = GAME_CONFIG.HEIGHT
    }
    
    // Draw floor first
    this.drawFloor()
    
    // Draw walls if provided, otherwise use default
    if (Array.isArray(layout.walls) && layout.walls.length > 0) {
      this.drawWallsFromLayout(layout.walls)
    } else {
      this.drawWalls()
    }
    
    // Draw zones if provided
    if (Array.isArray(layout.zones) && layout.zones.length > 0) {
      this.drawZonesFromLayout(layout.zones)
    }
    
    // Draw rooms
    if (Array.isArray(layout.rooms) && layout.rooms.length > 0) {
      layout.rooms.forEach((room: RoomData) => {
        if (room && room.id) {
          this.drawRoom(room)
        }
      })
    }
    
    // Draw desks
    if (Array.isArray(layout.desks) && layout.desks.length > 0) {
      layout.desks.forEach((desk: DeskData) => {
        if (desk && desk.id) {
          this.drawDesk(desk)
        }
      })
    }
    
    // Draw decorations
    if (Array.isArray(layout.decorations) && layout.decorations.length > 0) {
      layout.decorations.forEach((decoration: DecorationData) => {
        if (decoration && decoration.id) {
          this.drawDecoration(decoration)
        }
      })
    }
  }

  /**
   * Draw walls from layout data - extracted method for cleaner code
   */
  private drawWallsFromLayout(walls: WallData[]): void {
    walls.forEach((wall: WallData) => {
      this.graphics.fillStyle(GAME_CONFIG.COLORS.WALL)
      
      // Support both formats: {x, y, width, height} and {start, end, thickness}
      if (wall.start && wall.end) {
        this.drawWallSegment(wall)
      } else {
        this.drawRectWall(wall)
      }
    })
  }

  /**
   * Draw a wall segment from start/end coordinates
   */
  private drawWallSegment(wall: WallData): void {
    const startX = wall.start!.x
    const startY = wall.start!.y
    const endX = wall.end!.x
    const endY = wall.end!.y
    const thickness = wall.thickness || 32
    
    // Determine if horizontal or vertical wall
    if (startY === endY) {
      // Horizontal wall
      const x = Math.min(startX, endX)
      const width = Math.abs(endX - startX)
      if (width > 0) {
        this.graphics.fillRect(x, startY, width, thickness)
        this.addWallCollision(x + width / 2, startY + thickness / 2, width, thickness)
      }
    } else if (startX === endX) {
      // Vertical wall
      const y = Math.min(startY, endY)
      const height = Math.abs(endY - startY)
      if (height > 0) {
        this.graphics.fillRect(startX, y, thickness, height)
        this.addWallCollision(startX + thickness / 2, y + height / 2, thickness, height)
      }
    } else {
      // Diagonal or complex wall
      this.graphics.lineStyle(thickness, GAME_CONFIG.COLORS.WALL, 1)
      this.graphics.lineBetween(startX, startY, endX, endY)

      const minX = Math.min(startX, endX) - thickness / 2
      const minY = Math.min(startY, endY) - thickness / 2
      const colliderWidth = Math.abs(endX - startX) + thickness
      const colliderHeight = Math.abs(endY - startY) + thickness
      this.addWallCollision(minX + colliderWidth / 2, minY + colliderHeight / 2, colliderWidth, colliderHeight)
    }
  }

  /**
   * Draw a rectangular wall
   */
  private drawRectWall(wall: WallData): void {
    const x = wall.x ?? 0
    const y = wall.y ?? 0
    const width = wall.width ?? 0
    const height = wall.height ?? 0
    
    if (width > 0 && height > 0) {
      this.graphics.fillRect(x, y, width, height)
      this.addWallCollision(x + width / 2, y + height / 2, width, height)
    }
  }

  /**
   * Draw zones from layout data
   */
  private drawZonesFromLayout(zones: ZoneData[]): void {
    zones.forEach((zone: ZoneData) => {
      const color = this.getZoneColor(zone.type)
      
      // Support both formats: {x, y, width, height} and {bounds: {x, y, width, height}}
      const x = zone.bounds?.x ?? zone.x
      const y = zone.bounds?.y ?? zone.y
      const width = zone.bounds?.width ?? zone.width
      const height = zone.bounds?.height ?? zone.height
      
      // Validate zone dimensions
      if (!this.validateBounds({ x, y, width, height }, zone.id || zone.type)) {
        return
      }
      
      this.graphics.fillStyle(color, 0.1)
      this.graphics.fillRect(x, y, width, height)
      this.graphics.lineStyle(2, color, 0.3)
      this.graphics.strokeRect(x, y, width, height)
    })
  }
  
  private getZoneColor(type: string): number {
    if (!this.zoneColorMap) {
      this.zoneColorMap = {
        'workspace': 0x4a90e2,
        'meeting': 0x7cb342,
        'social': 0xffa726,
        'quiet': 0x9575cd,
        'collaboration': 0x26c6da,
        'focus': 0x9575cd,
        'break': 0xffa726,
        'lounge': 0xff7043,
        'creative': 0xec407a,
        'lobby': 0x78909c,
        'reception': 0x78909c,
        'kitchen': 0xffca28,
        'conference': 0x66bb6a,
        'executive': 0x5c6bc0,
        'open-office': 0x42a5f5,
        'private-office': 0x7e57c2,
      }
    }
    return this.zoneColorMap[type] || 0x78909c
  }
  
  private drawFloor(): void {
    const { TILE_SIZE, COLORS } = GAME_CONFIG
    const width = this.layoutWidth
    const height = this.layoutHeight

    // Main floor
    this.graphics.fillStyle(COLORS.FLOOR)
    this.graphics.fillRect(0, 0, width, height)

    // Grid pattern
    this.graphics.lineStyle(1, COLORS.FLOOR_GRID, 0.5)

    for (let x = 0; x <= width; x += TILE_SIZE) {
      this.graphics.lineBetween(x, 0, x, height)
    }

    for (let y = 0; y <= height; y += TILE_SIZE) {
      this.graphics.lineBetween(0, y, width, y)
    }
  }
  
  private drawWalls(): void {
    const { COLORS, TILE_SIZE } = GAME_CONFIG
    const width = this.layoutWidth
    const height = this.layoutHeight
    const wallThickness = TILE_SIZE

    this.graphics.fillStyle(COLORS.WALL)

    // Top wall
    this.graphics.fillRect(0, 0, width, wallThickness)
    this.addWallCollision(width / 2, wallThickness / 2, width, wallThickness)

    // Bottom wall
    this.graphics.fillRect(0, height - wallThickness, width, wallThickness)
    this.addWallCollision(width / 2, height - wallThickness / 2, width, wallThickness)

    // Left wall
    this.graphics.fillRect(0, 0, wallThickness, height)
    this.addWallCollision(wallThickness / 2, height / 2, wallThickness, height)

    // Right wall
    this.graphics.fillRect(width - wallThickness, 0, wallThickness, height)
    this.addWallCollision(width - wallThickness / 2, height / 2, wallThickness, height)

    // Wall details (darker top)
    this.graphics.fillStyle(COLORS.WALL_DARK)
    this.graphics.fillRect(0, 0, width, 8)
    this.graphics.fillRect(0, 0, 8, height)
  }
  
  private drawMeetingRooms(): void {
    const meetingRooms = GAME_CONFIG.DEFAULT_LAYOUTS.MEETING_ROOMS
    meetingRooms.forEach(room => this.drawRoom(room))
  }
  
  private drawBreakRoom(): void {
    const breakRoom = GAME_CONFIG.DEFAULT_LAYOUTS.BREAK_ROOM
    this.drawRoom(breakRoom)
  }
  
  /**
   * Get room colors with lazy initialization for performance
   */
  private getRoomColors(type: string): RoomColors {
    if (!this.roomColorMap) {
      const { COLORS } = GAME_CONFIG
      this.roomColorMap = {
        meeting: { fill: COLORS.MEETING_ROOM, border: COLORS.MEETING_ROOM_BORDER },
        break: { fill: COLORS.BREAK_ROOM, border: COLORS.BREAK_ROOM_BORDER },
        private: { fill: 0xf3e5f5, border: 0x9c27b0 },
        conference: { fill: COLORS.MEETING_ROOM, border: COLORS.MEETING_ROOM_BORDER },
        phone: { fill: 0xe3f2fd, border: 0x2196f3 },
        'phone-booth': { fill: 0xe3f2fd, border: 0x2196f3 },
        focus: { fill: 0xfff3e0, border: 0xff9800 },
        lounge: { fill: 0xf3e5f5, border: 0x9c27b0 },
      }
    }
    return this.roomColorMap[type] || { fill: GAME_CONFIG.COLORS.MEETING_ROOM, border: GAME_CONFIG.COLORS.MEETING_ROOM_BORDER }
  }
  
  private drawRoom(room: RoomData): void {
    // Guard against missing bounds
    if (!room || !room.bounds) {
      console.warn(`Room ${room?.id || 'unknown'} missing bounds data, skipping render`)
      return
    }
    
    // Validate bounds
    if (!this.validateBounds(room.bounds, room.id)) {
      return
    }
    
    const roomColors = this.getRoomColors(room.type)
    const bounds = room.bounds  // Store once to avoid re-destructuring
    
    // Room floor
    this.graphics.fillStyle(roomColors.fill)
    this.graphics.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
    
    // Room walls/border
    this.graphics.lineStyle(4, roomColors.border, 1)
    this.graphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
    
    // Room label
    const label = this.scene.add.text(
      bounds.x + bounds.width / 2,
      bounds.y + 15,
      room.name,
      {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#333333',
        fontStyle: 'bold',
      }
    )
    label.setOrigin(0.5, 0)
    this.textObjects.push(label)
    
    // Draw room-specific furniture - pass bounds to avoid re-destructuring
    if (room.type === 'meeting') {
      this.drawMeetingTable(bounds)
    } else if (room.type === 'break') {
      this.drawBreakRoomFurniture(bounds)
    }
  }
  
  private drawMeetingTable(bounds: Bounds): void {
    const { COLORS, FURNITURE } = GAME_CONFIG
    
    // Skip if room is too small for furniture
    if (bounds.width < 100 || bounds.height < 80) {
      return
    }
    
    const { x, y, width, height } = bounds
    
    const tableWidth = Math.min(width * 0.6, width - 40)
    const tableHeight = Math.min(height * 0.4, height - 60)
    const tableX = x + (width - tableWidth) / 2
    const tableY = y + (height - tableHeight) / 2 + 20
    
    // Table
    this.graphics.fillStyle(COLORS.DESK)
    this.graphics.fillRoundedRect(tableX, tableY, tableWidth, tableHeight, 8)
    
    // Table top
    this.graphics.fillStyle(COLORS.DESK_TOP)
    this.graphics.fillRoundedRect(tableX + 4, tableY + 4, tableWidth - 8, tableHeight - 8, 6)
    
    // Chairs around table with bounds checking
    const chairSize = FURNITURE.MEETING_CHAIR_SIZE
    const chairOffset = 5
    
    // Check if we can draw chairs above and below table
    const canDrawTopChairs = tableY - chairSize - chairOffset >= y
    const canDrawBottomChairs = tableY + tableHeight + chairSize + chairOffset <= y + height
    
    const chairPositions: Position[] = []
    
    // Top row chairs (only if within bounds)
    if (canDrawTopChairs) {
      chairPositions.push(
        { x: tableX + tableWidth * 0.25, y: tableY - chairSize - chairOffset },
        { x: tableX + tableWidth * 0.5, y: tableY - chairSize - chairOffset },
        { x: tableX + tableWidth * 0.75, y: tableY - chairSize - chairOffset }
      )
    }
    
    // Bottom row chairs (only if within bounds)
    if (canDrawBottomChairs) {
      chairPositions.push(
        { x: tableX + tableWidth * 0.25, y: tableY + tableHeight + chairOffset },
        { x: tableX + tableWidth * 0.5, y: tableY + tableHeight + chairOffset },
        { x: tableX + tableWidth * 0.75, y: tableY + tableHeight + chairOffset }
      )
    }
    
    // Draw chairs
    this.graphics.fillStyle(COLORS.CHAIR)
    chairPositions.forEach(pos => {
      this.graphics.fillRoundedRect(pos.x - chairSize / 2, pos.y, chairSize, chairSize, 4)
    })
  }
  
  private drawBreakRoomFurniture(bounds: Bounds): void {
    const { COLORS, FURNITURE } = GAME_CONFIG
    
    // Skip if room is too small for furniture
    if (bounds.width < 150 || bounds.height < 100) {
      return
    }
    
    const { x, y, width, height } = bounds
    
    // Couch
    const couchX = x + 30
    const couchY = y + height - 80
    this.graphics.fillStyle(0x6b5b95)
    this.graphics.fillRoundedRect(couchX, couchY, 100, 50, 8)
    this.graphics.fillStyle(0x7d6ba0)
    this.graphics.fillRoundedRect(couchX + 5, couchY + 5, 90, 35, 6)
    
    // Coffee table
    this.graphics.fillStyle(COLORS.DESK)
    this.graphics.fillRoundedRect(
      couchX + FURNITURE.COFFEE_TABLE_OFFSET_X, 
      couchY + FURNITURE.COFFEE_TABLE_OFFSET_Y, 
      FURNITURE.COFFEE_TABLE_WIDTH, 
      FURNITURE.COFFEE_TABLE_HEIGHT, 
      4
    )
    
    // Coffee machine
    this.graphics.fillStyle(COLORS.COFFEE_MACHINE)
    this.graphics.fillRect(x + width - 60, y + 40, 40, 50)
    this.graphics.fillStyle(0x8d6e63)
    this.graphics.fillRect(x + width - 55, y + 50, 30, 30)
  }
  
  private drawDesks(): void {
    const desks = GAME_CONFIG.DEFAULT_LAYOUTS.DESKS
    desks.forEach(desk => this.drawDesk(desk))
  }
  
  private drawDesk(desk: DeskData): void {
    const { COLORS, FURNITURE } = GAME_CONFIG
    
    // Guard against missing position or dimensions
    if (!desk || !desk.position || !desk.dimensions) {
      console.warn(`Desk ${desk?.id || 'unknown'} missing position or dimensions, skipping render`)
      return
    }
    
    // Validate position and dimensions
    const { x, y } = desk.position
    const { width, height } = desk.dimensions
    
    if (!this.validatePosition(x, y) || width <= 0 || height <= 0) {
      console.warn(`Desk ${desk.id} has invalid position or dimensions, skipping render`)
      return
    }
    
    // Desk body
    this.graphics.fillStyle(COLORS.DESK)
    this.graphics.fillRoundedRect(x, y, width, height, 4)
    
    // Desk top
    this.graphics.fillStyle(COLORS.DESK_TOP)
    this.graphics.fillRoundedRect(x + 3, y + 3, width - 6, height - 6, 3)
    
    // Computer monitor
    const monitorX = x + width / 2 - FURNITURE.MONITOR_WIDTH / 2
    const monitorY = y + 8
    
    // Monitor
    this.graphics.fillStyle(0x333333)
    this.graphics.fillRoundedRect(monitorX, monitorY, FURNITURE.MONITOR_WIDTH, FURNITURE.MONITOR_HEIGHT, 2)
    this.graphics.fillStyle(0x4fc3f7)
    this.graphics.fillRect(monitorX + 2, monitorY + 2, FURNITURE.MONITOR_WIDTH - 4, FURNITURE.MONITOR_HEIGHT - 4)
    
    // Monitor stand
    this.graphics.fillStyle(0x333333)
    this.graphics.fillRect(
      monitorX + FURNITURE.MONITOR_WIDTH / 2 - FURNITURE.MONITOR_STAND_WIDTH / 2, 
      monitorY + FURNITURE.MONITOR_HEIGHT, 
      FURNITURE.MONITOR_STAND_WIDTH, 
      FURNITURE.MONITOR_STAND_HEIGHT
    )
    
    // Chair
    const chairX = x + width / 2 - FURNITURE.DESK_CHAIR_SIZE / 2
    const chairY = y + height + FURNITURE.CHAIR_OFFSET
    
    this.graphics.fillStyle(COLORS.CHAIR)
    this.graphics.fillRoundedRect(chairX, chairY, FURNITURE.DESK_CHAIR_SIZE, FURNITURE.DESK_CHAIR_SIZE, 4)
    this.graphics.fillStyle(0x1e40af)
    this.graphics.fillRoundedRect(chairX + 3, chairY + 3, FURNITURE.DESK_CHAIR_SIZE - 6, FURNITURE.DESK_CHAIR_SIZE - 6, 3)
  }
  
  private drawDecorations(): void {
    const decorations = GAME_CONFIG.DEFAULT_LAYOUTS.DECORATIONS
    decorations.forEach(deco => this.drawDecoration(deco))
  }
  
  private drawDecoration(deco: DecorationData): void {
    // Guard against missing position
    if (!deco || !deco.position) {
      console.warn(`Decoration ${deco?.id || 'unknown'} missing position, skipping render`)
      return
    }
    
    // Validate position
    const { x, y } = deco.position
    if (!this.validatePosition(x, y)) {
      console.warn(`Decoration ${deco.id} has invalid position, skipping render`)
      return
    }
    
    // Normalize decoration type for consistency
    const type = (deco.type || '').toLowerCase().replace(/_/g, '-')
    
    switch (type) {
      case 'plant':
        this.drawPlant(x, y, 'plant')
        break
      case 'plant-small':
        this.drawPlant(x, y, 'plant-small')
        break
      case 'plant-medium':
        this.drawPlant(x, y, 'plant-medium')
        break
      case 'plant-large':
        this.drawPlant(x, y, 'plant-large')
        break
      case 'whiteboard':
        this.drawWhiteboard(x, y)
        break
      case 'coffee-machine':
        this.drawCoffeeMachine(x, y)
        break
      case 'couch':
      case 'lounge-chair':
        this.drawCouch(x, y)
        break
      case 'water-cooler':
        this.drawWaterCooler(x, y)
        break
      case 'artwork':
        this.drawArtwork(x, y)
        break
      default:
        // For unknown decoration types, just draw a simple marker
        this.graphics.fillStyle(0x9e9e9e)
        this.graphics.fillCircle(x, y, 10)
        break
    }
  }
  
  private drawPlant(x: number, y: number, type: string = 'plant'): void {
    const { COLORS } = GAME_CONFIG
    
    // Validate coordinates
    if (!this.validatePosition(x, y)) {
      return
    }
    
    // Determine size based on type - normalize type names
    let potWidth = 24, potHeight = 20, leafSize = 15
    const normalizedType = type.toLowerCase()
    
    if (normalizedType === 'plant-small') {
      potWidth = 16; potHeight = 14; leafSize = 10
    } else if (normalizedType === 'plant-medium') {
      potWidth = 24; potHeight = 20; leafSize = 15
    } else if (normalizedType === 'plant-large') {
      potWidth = 32; potHeight = 28; leafSize = 20
    }
    
    // Pot
    this.graphics.fillStyle(0xd2691e)
    this.graphics.fillRect(x - potWidth/2, y + 10, potWidth, potHeight)
    this.graphics.fillStyle(0xcd853f)
    this.graphics.fillRect(x - potWidth/2 - 3, y + 8, potWidth + 6, 6)
    
    // Plant leaves
    this.graphics.fillStyle(COLORS.PLANT)
    this.graphics.fillCircle(x, y - 5, leafSize)
    this.graphics.fillCircle(x - leafSize * 0.7, y, leafSize * 0.7)
    this.graphics.fillCircle(x + leafSize * 0.7, y, leafSize * 0.7)
    this.graphics.fillCircle(x, y + 5, leafSize * 0.8)
  }
  
  private drawWhiteboard(x: number, y: number): void {
    const { COLORS } = GAME_CONFIG
    
    // Validate coordinates
    if (!this.validatePosition(x, y)) {
      return
    }
    
    const width = 120
    const height = 80
    
    // Board frame
    this.graphics.fillStyle(COLORS.WHITEBOARD_BORDER)
    this.graphics.fillRect(x, y, width, height)
    
    // White surface
    this.graphics.fillStyle(COLORS.WHITEBOARD)
    this.graphics.fillRect(x + 4, y + 4, width - 8, height - 8)
    
    // Some "writing" lines
    this.graphics.lineStyle(2, 0x333333, 0.3)
    this.graphics.lineBetween(x + 15, y + 20, x + width - 30, y + 20)
    this.graphics.lineBetween(x + 15, y + 35, x + width - 50, y + 35)
    this.graphics.lineBetween(x + 15, y + 50, x + width - 20, y + 50)
    
    // Marker tray
    this.graphics.fillStyle(0x9e9e9e)
    this.graphics.fillRect(x + 10, y + height - 2, width - 20, 8)
    
    // Markers
    const markerColors = [0xff0000, 0x0000ff, 0x00aa00, 0x000000]
    markerColors.forEach((color, i) => {
      this.graphics.fillStyle(color)
      this.graphics.fillRect(x + 20 + i * 20, y + height, 8, 6)
    })
  }
  
  private drawCoffeeMachine(x: number, y: number): void {
    const { COLORS } = GAME_CONFIG
    
    // Validate coordinates
    if (!this.validatePosition(x, y)) {
      return
    }
    
    // Machine body
    this.graphics.fillStyle(COLORS.COFFEE_MACHINE)
    this.graphics.fillRoundedRect(x - 12, y - 20, 24, 40, 3)
    
    // Control panel
    this.graphics.fillStyle(0x222222)
    this.graphics.fillRoundedRect(x - 8, y - 15, 16, 10, 2)
    
    // Buttons
    this.graphics.fillStyle(0x4caf50)
    this.graphics.fillCircle(x - 4, y - 10, 2)
    this.graphics.fillStyle(0xf44336)
    this.graphics.fillCircle(x + 4, y - 10, 2)
    
    // Indicator light
    this.graphics.fillStyle(0xdc2626)
    this.graphics.fillCircle(x, y + 5, 3)
    
    // Drip tray
    this.graphics.fillStyle(0x333333)
    this.graphics.fillRect(x - 10, y + 15, 20, 4)
  }
  
  private drawCouch(x: number, y: number): void {
    // Validate coordinates
    if (!this.validatePosition(x, y)) {
      return
    }
    
    const width = 70
    const height = 30
    
    // Couch body
    this.graphics.fillStyle(0x7c3aed)
    this.graphics.fillRoundedRect(x - width/2, y - height/2, width, height, 6)
    
    // Cushions
    this.graphics.fillStyle(0x8b5cf6)
    this.graphics.fillRoundedRect(x - width/2 + 5, y - height/2 + 4, width - 10, height - 12, 4)
    
    // Arm rests
    this.graphics.fillStyle(0x7c3aed)
    this.graphics.fillRoundedRect(x - width/2 - 4, y - height/2 + 2, 8, height - 4, 3)
    this.graphics.fillRoundedRect(x + width/2 - 4, y - height/2 + 2, 8, height - 4, 3)
  }
  
  private drawWaterCooler(x: number, y: number): void {
    // Validate coordinates
    if (!this.validatePosition(x, y)) {
      return
    }
    
    // Cooler body
    this.graphics.fillStyle(0x4fc3f7)
    this.graphics.fillRoundedRect(x - 12, y - 16, 24, 32, 4)
    
    // Water container
    this.graphics.fillStyle(0x81d4fa, 0.5)
    this.graphics.fillRoundedRect(x - 8, y - 12, 16, 20, 2)
    
    // Spout
    this.graphics.fillStyle(0x0288d1)
    this.graphics.fillCircle(x, y + 12, 3)
    
    // Base
    this.graphics.fillStyle(0x0288d1)
    this.graphics.fillRect(x - 10, y + 14, 20, 4)
  }
  
  private drawArtwork(x: number, y: number): void {
    // Validate coordinates
    if (!this.validatePosition(x, y)) {
      return
    }
    
    const width = 64
    const height = 48
    
    // Frame
    this.graphics.fillStyle(0x8b4513)
    this.graphics.fillRect(x, y, width, height)
    
    // Canvas
    this.graphics.fillStyle(0xf5f5dc)
    this.graphics.fillRect(x + 4, y + 4, width - 8, height - 8)
    
    // Simple abstract art pattern
    this.graphics.fillStyle(0xff6b6b)
    this.graphics.fillCircle(x + width/2, y + height/2, 12)
    this.graphics.fillStyle(0x4ecdc4)
    this.graphics.fillRect(x + 10, y + 10, 15, 15)
    this.graphics.fillStyle(0xffe66d)
    this.graphics.fillTriangle(
      x + width - 15, y + height - 10,
      x + width - 5, y + height - 10,
      x + width - 10, y + height - 25
    )
  }
  
  public getCollisionBodies(): Phaser.GameObjects.Rectangle[] {
    // Collision bodies are now created during drawWalls() or buildFromLayoutData()
    // This method simply returns the existing bodies
    return this.collisionBodies
  }
}
