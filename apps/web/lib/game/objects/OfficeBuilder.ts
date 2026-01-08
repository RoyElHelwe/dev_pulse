import * as Phaser from 'phaser'
import { GAME_CONFIG } from '../constants'
import { DeskData, RoomData, DecorationData } from '../types'

export class OfficeBuilder {
  private scene: Phaser.Scene
  private graphics: Phaser.GameObjects.Graphics
  private collisionBodies: Phaser.GameObjects.Rectangle[] = []
  private layoutWidth: number = GAME_CONFIG.WIDTH
  private layoutHeight: number = GAME_CONFIG.HEIGHT
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.graphics = scene.add.graphics()
  }
  
  /**
   * Add a collision body for walls
   */
  private addWallCollision(x: number, y: number, width: number, height: number): void {
    const body = this.scene.add.rectangle(x, y, width, height, 0x000000, 0)
    this.scene.physics.add.existing(body, true) // true = static body
    this.collisionBodies.push(body)
  }
  
  public buildOffice(layoutData?: any): void {
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
  
  private buildFromLayoutData(layout: any): void {
    // Get layout dimensions
    this.layoutWidth = layout.dimensions?.width ?? layout.width ?? GAME_CONFIG.WIDTH
    this.layoutHeight = layout.dimensions?.height ?? layout.height ?? GAME_CONFIG.HEIGHT
    
    // Draw floor first
    this.drawFloor()
    
    // Draw walls if provided, otherwise use default
    if (layout.walls && layout.walls.length > 0) {
      layout.walls.forEach((wall: any) => {
        this.graphics.fillStyle(GAME_CONFIG.COLORS.WALL)
        
        // Support both formats: {x, y, width, height} and {start, end, thickness}
        if (wall.start && wall.end) {
          // Convert start/end/thickness format to rect
          const startX = wall.start.x
          const startY = wall.start.y
          const endX = wall.end.x
          const endY = wall.end.y
          const thickness = wall.thickness || 32
          
          // Determine if horizontal or vertical wall
          if (startY === endY) {
            // Horizontal wall
            const x = Math.min(startX, endX)
            const width = Math.abs(endX - startX)
            if (width > 0) {
              this.graphics.fillRect(x, startY, width, thickness)
              // Add collision body (center coordinates)
              this.addWallCollision(x + width / 2, startY + thickness / 2, width, thickness)
            }
          } else if (startX === endX) {
            // Vertical wall
            const y = Math.min(startY, endY)
            const height = Math.abs(endY - startY)
            if (height > 0) {
              this.graphics.fillRect(startX, y, thickness, height)
              // Add collision body (center coordinates)
              this.addWallCollision(startX + thickness / 2, y + height / 2, thickness, height)
            }
          } else {
            // Diagonal or complex wall - draw as thick line (no collision for diagonal)
            this.graphics.lineStyle(thickness, GAME_CONFIG.COLORS.WALL, 1)
            this.graphics.lineBetween(startX, startY, endX, endY)
          }
        } else {
          // Standard x, y, width, height format
          const x = wall.x
          const y = wall.y
          const width = wall.width
          const height = wall.height
          this.graphics.fillRect(x, y, width, height)
          // Add collision body (center coordinates)
          this.addWallCollision(x + width / 2, y + height / 2, width, height)
        }
      })
    } else {
      this.drawWalls()
    }
    
    // Draw zones if provided
    if (layout.zones && layout.zones.length > 0) {
      layout.zones.forEach((zone: any) => {
        const color = this.getZoneColor(zone.type)
        
        // Support both formats: {x, y, width, height} and {bounds: {x, y, width, height}}
        const x = zone.bounds?.x ?? zone.x
        const y = zone.bounds?.y ?? zone.y
        const width = zone.bounds?.width ?? zone.width
        const height = zone.bounds?.height ?? zone.height
        
        this.graphics.fillStyle(color, 0.1)
        this.graphics.fillRect(x, y, width, height)
        this.graphics.lineStyle(2, color, 0.3)
        this.graphics.strokeRect(x, y, width, height)
      })
    }
    
    // Draw rooms
    if (layout.rooms && layout.rooms.length > 0) {
      layout.rooms.forEach((room: any) => {
        // Support both formats for rooms
        const x = room.bounds?.x ?? room.x
        const y = room.bounds?.y ?? room.y
        const width = room.bounds?.width ?? room.width
        const height = room.bounds?.height ?? room.height
        
        this.drawRoom({
          id: room.id,
          name: room.name || 'Room',
          x: x,
          y: y,
          width: width,
          height: height,
          type: room.type || 'meeting',
        })
      })
    }
    
    // Draw desks
    if (layout.desks && layout.desks.length > 0) {
      layout.desks.forEach((desk: any) => {
        // Support both formats: {x, y} and {position: {x, y}}
        const x = desk.position?.x ?? desk.x
        const y = desk.position?.y ?? desk.y
        const width = desk.dimensions?.width ?? desk.width ?? 96
        const height = desk.dimensions?.height ?? desk.height ?? 64
        
        this.drawDesk({
          id: desk.id,
          x: x,
          y: y,
          width: width,
          height: height,
          rotation: desk.rotation || 0,
          type: desk.type || 'standard',
          occupantId: desk.occupantId || null,
        })
      })
    }
    
    // Draw decorations
    if (layout.decorations && layout.decorations.length > 0) {
      layout.decorations.forEach((decoration: any) => {
        // Support both formats: {x, y} and {position: {x, y}}
        const x = decoration.position?.x ?? decoration.x
        const y = decoration.position?.y ?? decoration.y
        
        this.drawDecoration({
          id: decoration.id,
          x: x,
          y: y,
          type: decoration.type,
        })
      })
    }
  }
  
  private getZoneColor(type: string): number {
    const colors: Record<string, number> = {
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
    return colors[type] || 0x78909c
  }
  
  private drawFloor(): void {
    const { TILE_SIZE, WIDTH, HEIGHT, COLORS } = GAME_CONFIG
    
    // Main floor
    this.graphics.fillStyle(COLORS.FLOOR)
    this.graphics.fillRect(0, 0, WIDTH, HEIGHT)
    
    // Grid pattern
    this.graphics.lineStyle(1, COLORS.FLOOR_GRID, 0.5)
    
    for (let x = 0; x <= WIDTH; x += TILE_SIZE) {
      this.graphics.lineBetween(x, 0, x, HEIGHT)
    }
    
    for (let y = 0; y <= HEIGHT; y += TILE_SIZE) {
      this.graphics.lineBetween(0, y, WIDTH, y)
    }
  }
  
  private drawWalls(): void {
    const { COLORS, WIDTH, HEIGHT, TILE_SIZE } = GAME_CONFIG
    const wallThickness = TILE_SIZE
    
    this.graphics.fillStyle(COLORS.WALL)
    
    // Top wall
    this.graphics.fillRect(0, 0, WIDTH, wallThickness)
    
    // Bottom wall
    this.graphics.fillRect(0, HEIGHT - wallThickness, WIDTH, wallThickness)
    
    // Left wall
    this.graphics.fillRect(0, 0, wallThickness, HEIGHT)
    
    // Right wall
    this.graphics.fillRect(WIDTH - wallThickness, 0, wallThickness, HEIGHT)
    
    // Wall details (darker top)
    this.graphics.fillStyle(COLORS.WALL_DARK)
    this.graphics.fillRect(0, 0, WIDTH, 8)
    this.graphics.fillRect(0, 0, 8, HEIGHT)
  }
  
  private drawMeetingRooms(): void {
    const { COLORS, TILE_SIZE } = GAME_CONFIG
    
    // Meeting Room 1 (top right)
    this.drawRoom({
      id: 'meeting-1',
      name: 'Meeting Room A',
      x: 850,
      y: 50,
      width: 300,
      height: 200,
      type: 'meeting',
    })
    
    // Meeting Room 2 (bottom left)
    this.drawRoom({
      id: 'meeting-2',
      name: 'Meeting Room B',
      x: 50,
      y: 500,
      width: 250,
      height: 180,
      type: 'meeting',
    })
  }
  
  private drawBreakRoom(): void {
    // Break room (bottom right)
    this.drawRoom({
      id: 'break',
      name: 'Break Room',
      x: 900,
      y: 550,
      width: 250,
      height: 200,
      type: 'break',
    })
  }
  
  private drawRoom(room: RoomData): void {
    const { COLORS } = GAME_CONFIG
    
    const colors: Record<string, { fill: number, border: number }> = {
      meeting: { fill: COLORS.MEETING_ROOM, border: COLORS.MEETING_ROOM_BORDER },
      break: { fill: COLORS.BREAK_ROOM, border: COLORS.BREAK_ROOM_BORDER },
      private: { fill: 0xf3e5f5, border: 0x9c27b0 },
      conference: { fill: COLORS.MEETING_ROOM, border: COLORS.MEETING_ROOM_BORDER },
      phone: { fill: 0xe3f2fd, border: 0x2196f3 },
      'phone-booth': { fill: 0xe3f2fd, border: 0x2196f3 },
      focus: { fill: 0xfff3e0, border: 0xff9800 },
      lounge: { fill: 0xf3e5f5, border: 0x9c27b0 },
    }
    
    const roomColors = colors[room.type] || { fill: COLORS.MEETING_ROOM, border: COLORS.MEETING_ROOM_BORDER }
    
    // Room floor
    this.graphics.fillStyle(roomColors.fill)
    this.graphics.fillRect(room.x, room.y, room.width, room.height)
    
    // Room walls/border
    this.graphics.lineStyle(4, roomColors.border, 1)
    this.graphics.strokeRect(room.x, room.y, room.width, room.height)
    
    // Room label
    const label = this.scene.add.text(
      room.x + room.width / 2,
      room.y + 15,
      room.name,
      {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color: '#333333',
        fontStyle: 'bold',
      }
    )
    label.setOrigin(0.5, 0)
    
    // Draw room-specific furniture
    if (room.type === 'meeting') {
      this.drawMeetingTable(room)
    } else if (room.type === 'break') {
      this.drawBreakRoomFurniture(room)
    }
  }
  
  private drawMeetingTable(room: RoomData): void {
    const { COLORS } = GAME_CONFIG
    
    const tableWidth = room.width * 0.6
    const tableHeight = room.height * 0.4
    const tableX = room.x + (room.width - tableWidth) / 2
    const tableY = room.y + (room.height - tableHeight) / 2 + 20
    
    // Table
    this.graphics.fillStyle(COLORS.DESK)
    this.graphics.fillRoundedRect(tableX, tableY, tableWidth, tableHeight, 8)
    
    // Table top
    this.graphics.fillStyle(COLORS.DESK_TOP)
    this.graphics.fillRoundedRect(tableX + 4, tableY + 4, tableWidth - 8, tableHeight - 8, 6)
    
    // Chairs around table
    const chairSize = 20
    const chairPositions = [
      // Top row
      { x: tableX + tableWidth * 0.25, y: tableY - chairSize - 5 },
      { x: tableX + tableWidth * 0.5, y: tableY - chairSize - 5 },
      { x: tableX + tableWidth * 0.75, y: tableY - chairSize - 5 },
      // Bottom row
      { x: tableX + tableWidth * 0.25, y: tableY + tableHeight + 5 },
      { x: tableX + tableWidth * 0.5, y: tableY + tableHeight + 5 },
      { x: tableX + tableWidth * 0.75, y: tableY + tableHeight + 5 },
    ]
    
    chairPositions.forEach(pos => {
      this.graphics.fillStyle(COLORS.CHAIR)
      this.graphics.fillRoundedRect(pos.x - chairSize / 2, pos.y, chairSize, chairSize, 4)
    })
  }
  
  private drawBreakRoomFurniture(room: RoomData): void {
    const { COLORS } = GAME_CONFIG
    
    // Couch
    const couchX = room.x + 30
    const couchY = room.y + room.height - 80
    this.graphics.fillStyle(0x6b5b95)
    this.graphics.fillRoundedRect(couchX, couchY, 100, 50, 8)
    this.graphics.fillStyle(0x7d6ba0)
    this.graphics.fillRoundedRect(couchX + 5, couchY + 5, 90, 35, 6)
    
    // Coffee table
    this.graphics.fillStyle(COLORS.DESK)
    this.graphics.fillRoundedRect(couchX + 120, couchY + 10, 60, 30, 4)
    
    // Coffee machine
    this.graphics.fillStyle(COLORS.COFFEE_MACHINE)
    this.graphics.fillRect(room.x + room.width - 60, room.y + 40, 40, 50)
    this.graphics.fillStyle(0x8d6e63)
    this.graphics.fillRect(room.x + room.width - 55, room.y + 50, 30, 30)
  }
  
  private drawDesks(): void {
    const desks: DeskData[] = [
      // Row 1 (left side)
      { id: 'desk-1', x: 100, y: 100, width: 80, height: 50 },
      { id: 'desk-2', x: 200, y: 100, width: 80, height: 50 },
      { id: 'desk-3', x: 300, y: 100, width: 80, height: 50 },
      { id: 'desk-4', x: 400, y: 100, width: 80, height: 50 },
      
      // Row 2
      { id: 'desk-5', x: 100, y: 200, width: 80, height: 50 },
      { id: 'desk-6', x: 200, y: 200, width: 80, height: 50 },
      { id: 'desk-7', x: 300, y: 200, width: 80, height: 50 },
      { id: 'desk-8', x: 400, y: 200, width: 80, height: 50 },
      
      // Row 3
      { id: 'desk-9', x: 100, y: 350, width: 80, height: 50 },
      { id: 'desk-10', x: 200, y: 350, width: 80, height: 50 },
      { id: 'desk-11', x: 300, y: 350, width: 80, height: 50 },
      { id: 'desk-12', x: 400, y: 350, width: 80, height: 50 },
      
      // Center area desks
      { id: 'desk-13', x: 550, y: 300, width: 80, height: 50 },
      { id: 'desk-14', x: 650, y: 300, width: 80, height: 50 },
      { id: 'desk-15', x: 550, y: 400, width: 80, height: 50 },
      { id: 'desk-16', x: 650, y: 400, width: 80, height: 50 },
    ]
    
    desks.forEach(desk => this.drawDesk(desk))
  }
  
  private drawDesk(desk: DeskData): void {
    const { COLORS } = GAME_CONFIG
    
    // Desk body
    this.graphics.fillStyle(COLORS.DESK)
    this.graphics.fillRoundedRect(desk.x, desk.y, desk.width, desk.height, 4)
    
    // Desk top
    this.graphics.fillStyle(COLORS.DESK_TOP)
    this.graphics.fillRoundedRect(desk.x + 3, desk.y + 3, desk.width - 6, desk.height - 6, 3)
    
    // Computer monitor
    const monitorWidth = 25
    const monitorHeight = 18
    const monitorX = desk.x + desk.width / 2 - monitorWidth / 2
    const monitorY = desk.y + 8
    
    // Monitor
    this.graphics.fillStyle(0x333333)
    this.graphics.fillRoundedRect(monitorX, monitorY, monitorWidth, monitorHeight, 2)
    this.graphics.fillStyle(0x4fc3f7)
    this.graphics.fillRect(monitorX + 2, monitorY + 2, monitorWidth - 4, monitorHeight - 4)
    
    // Monitor stand
    this.graphics.fillStyle(0x333333)
    this.graphics.fillRect(monitorX + monitorWidth / 2 - 3, monitorY + monitorHeight, 6, 5)
    
    // Chair
    const chairX = desk.x + desk.width / 2 - 12
    const chairY = desk.y + desk.height + 8
    
    this.graphics.fillStyle(COLORS.CHAIR)
    this.graphics.fillRoundedRect(chairX, chairY, 24, 24, 4)
    this.graphics.fillStyle(0x1e40af)
    this.graphics.fillRoundedRect(chairX + 3, chairY + 3, 18, 18, 3)
  }
  
  private drawDecorations(): void {
    const decorations: DecorationData[] = [
      // Plants
      { id: 'plant-1', type: 'plant', x: 60, y: 60 },
      { id: 'plant-2', type: 'plant', x: 500, y: 60 },
      { id: 'plant-3', type: 'plant', x: 800, y: 300 },
      { id: 'plant-4', type: 'plant', x: 60, y: 450 },
      
      // Whiteboards
      { id: 'wb-1', type: 'whiteboard', x: 520, y: 80 },
      { id: 'wb-2', type: 'whiteboard', x: 350, y: 500 },
    ]
    
    decorations.forEach(deco => this.drawDecoration(deco))
  }
  
  private drawDecoration(deco: DecorationData): void {
    switch (deco.type) {
      case 'plant':
        this.drawPlant(deco.x, deco.y)
        break
      case 'whiteboard':
        this.drawWhiteboard(deco.x, deco.y)
        break
      default:
        // For unknown decoration types, just draw a simple marker
        this.graphics.fillStyle(0x9e9e9e)
        this.graphics.fillCircle(deco.x, deco.y, 10)
        break
    }
  }
  
  private drawPlant(x: number, y: number): void {
    const { COLORS } = GAME_CONFIG
    
    // Pot
    this.graphics.fillStyle(0xd2691e)
    this.graphics.fillRect(x - 12, y + 10, 24, 20)
    this.graphics.fillStyle(0xcd853f)
    this.graphics.fillRect(x - 15, y + 8, 30, 6)
    
    // Plant leaves
    this.graphics.fillStyle(COLORS.PLANT)
    this.graphics.fillCircle(x, y - 5, 15)
    this.graphics.fillCircle(x - 10, y, 10)
    this.graphics.fillCircle(x + 10, y, 10)
    this.graphics.fillCircle(x, y + 5, 12)
  }
  
  private drawWhiteboard(x: number, y: number): void {
    const { COLORS } = GAME_CONFIG
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
  
  public getCollisionBodies(): Phaser.GameObjects.Rectangle[] {
    // If collision bodies were already created from layout data, return them
    if (this.collisionBodies.length > 0) {
      return this.collisionBodies
    }
    
    // Otherwise create default perimeter walls (for default office)
    const { TILE_SIZE } = GAME_CONFIG
    const width = this.layoutWidth
    const height = this.layoutHeight
    
    // Wall collisions (center coordinates)
    // Top
    this.addWallCollision(width / 2, TILE_SIZE / 2, width, TILE_SIZE)
    // Bottom
    this.addWallCollision(width / 2, height - TILE_SIZE / 2, width, TILE_SIZE)
    // Left
    this.addWallCollision(TILE_SIZE / 2, height / 2, TILE_SIZE, height)
    // Right
    this.addWallCollision(width - TILE_SIZE / 2, height / 2, TILE_SIZE, height)
    
    return this.collisionBodies
  }
}
