// Office Layout Generator - Core Generation Logic
import {
  GenerationParams,
  GenerationResult,
  OfficeLayoutData,
  LayoutMetrics,
  ZoneData,
  DeskData,
  RoomData,
  DecorationData,
  SpawnPoint,
  PathwayData,
  WallData,
  Position,
  Dimensions,
  Rectangle,
  Department,
  DepartmentType,
  ZoneType,
  DeskType,
  RoomType,
  DecorationType,
  Direction,
} from './types'
import { ZONE_COLORS, ROOM_DEFAULTS, DESK_DEFAULTS, DECORATION_SIZES } from './constants'

// ============================================
// MAIN GENERATOR CLASS
// ============================================

export class OfficeLayoutGenerator {
  private readonly TILE_SIZE = 32
  private readonly AREA_PER_PERSON = 300 // Much larger sq units per person for spacious layout
  private readonly MIN_DESK_SPACING = 120
  private readonly PATHWAY_WIDTH = 150
  private readonly WALL_THICKNESS = 48

  /**
   * Generate an office layout based on provided parameters
   */
  public generate(params: GenerationParams): GenerationResult {
    try {
      // Calculate office dimensions based on team size
      const dimensions = this.calculateDimensions(params.teamSize)
      
      // Calculate space allocation
      const allocation = this.calculateSpaceAllocation(params)
      
      // Generate zones based on departments
      const zones = this.generateZones(params.departments, dimensions, allocation)
      
      // Generate main pathways
      const pathways = this.generatePathways(dimensions, zones)
      
      // Place desks within zones
      const desks = this.generateDesks(zones, params)
      
      // Place rooms (meeting rooms, focus rooms, etc.)
      const rooms = this.generateRooms(dimensions, params, zones)
      
      // Generate walls
      const walls = this.generateWalls(dimensions, rooms)
      
      // Add decorations
      const decorations = this.generateDecorations(dimensions, zones, params.culture)
      
      // Generate spawn points
      const spawnPoints = this.generateSpawnPoints(dimensions, zones)
      
      // Create the layout
      const layout: OfficeLayoutData = {
        metadata: {
          version: '1.0.0',
          generatedAt: new Date().toISOString(),
          mode: 'AI_AUTO',
          teamSize: params.teamSize,
        },
        dimensions,
        zones,
        desks,
        rooms,
        decorations,
        walls,
        spawnPoints,
        pathways,
      }
      
      // Calculate metrics
      const metrics = this.calculateMetrics(layout)
      
      // Generate reasoning
      const reasoning = this.generateReasoning(params, metrics)
      
      return {
        success: true,
        layout,
        metrics,
        reasoning,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during generation',
      }
    }
  }

  // ============================================
  // DIMENSION CALCULATIONS
  // ============================================

  private calculateDimensions(teamSize: number): Dimensions {
    const totalArea = teamSize * this.AREA_PER_PERSON * 3.0 // Triple the area for very spacious layout
    
    // Calculate optimal aspect ratio (roughly 16:10 for wide screens)
    const aspectRatio = 1.6
    const height = Math.sqrt(totalArea / aspectRatio)
    const width = height * aspectRatio
    
    // Round to tile size and ensure much larger minimums
    const finalWidth = Math.max(
      this.roundToTile(width),
      this.TILE_SIZE * 60 // 1920px minimum
    )
    const finalHeight = Math.max(
      this.roundToTile(height),
      this.TILE_SIZE * 45 // 1440px minimum
    )
    
    // Cap at much higher maximums for large offices
    return {
      width: Math.min(finalWidth, 9600),
      height: Math.min(finalHeight, 7200),
    }
  }

  private roundToTile(value: number): number {
    return Math.ceil(value / this.TILE_SIZE) * this.TILE_SIZE
  }

  // ============================================
  // SPACE ALLOCATION
  // ============================================

  private calculateSpaceAllocation(params: GenerationParams): SpaceAllocation {
    // Base allocation percentages
    let allocation: SpaceAllocation = {
      desks: 0.50,
      meetings: 0.15,
      social: 0.10,
      circulation: 0.20,
      special: 0.05,
    }
    
    // Adjust based on collaboration level
    if (params.collaboration === 'high') {
      allocation.meetings = 0.20
      allocation.social = 0.12
      allocation.desks = 0.43
    } else if (params.collaboration === 'low') {
      allocation.meetings = 0.10
      allocation.social = 0.08
      allocation.desks = 0.57
    }
    
    // Adjust based on work style
    if (params.workStyle === 'remote-first') {
      allocation.social = 0.15
      allocation.desks = 0.40
    } else if (params.workStyle === 'in-office') {
      allocation.desks = 0.55
      allocation.social = 0.08
    }
    
    return allocation
  }

  // ============================================
  // ZONE GENERATION
  // ============================================

  private generateZones(
    departments: Department[],
    dimensions: Dimensions,
    allocation: SpaceAllocation
  ): ZoneData[] {
    const zones: ZoneData[] = []
    const usableArea = this.getUsableArea(dimensions)
    const deskAreaTotal = (dimensions.width * dimensions.height) * allocation.desks
    
    // Sort departments by size (largest first for better placement)
    const sortedDepts = [...departments].sort((a, b) => b.headcount - a.headcount)
    
    // Calculate zone positions using a grid-based approach
    const zonePositions = this.calculateZonePositions(sortedDepts, usableArea, deskAreaTotal)
    
    sortedDepts.forEach((dept, index) => {
      const position = zonePositions[index]
      
      zones.push({
        id: `zone-${dept.type}-${index}`,
        type: dept.type as ZoneType,
        name: dept.customName || this.formatDepartmentName(dept.type),
        bounds: position,
        color: dept.color || ZONE_COLORS[dept.type] || ZONE_COLORS.custom,
        departmentType: dept.type,
        rules: this.getZoneRules(dept.type),
      })
    })
    
    // Add collaboration zone if space permits
    if (sortedDepts.length > 1) {
      const collabZone = this.findCollaborationZonePosition(zones, usableArea)
      if (collabZone) {
        zones.push({
          id: 'zone-collaboration',
          type: 'collaboration',
          name: 'Collaboration Hub',
          bounds: collabZone,
          color: ZONE_COLORS.collaboration,
          rules: {
            allowHotDesks: true,
            focusMode: false,
            allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'],
            notificationsEnabled: true,
          },
        })
      }
    }
    
    return zones
  }

  private calculateZonePositions(
    departments: Department[],
    usableArea: Rectangle,
    totalDeskArea: number
  ): Rectangle[] {
    const positions: Rectangle[] = []
    const totalHeadcount = departments.reduce((sum, d) => sum + d.headcount, 0)
    
    if (totalHeadcount === 0 || departments.length === 0) {
      return positions
    }
    
    // Create a professional grid layout with proper spacing
    const padding = 60
    const zonePadding = 40
    
    // Calculate available space for zones
    const availableWidth = usableArea.width - (padding * 2)
    const availableHeight = usableArea.height - (padding * 2)
    
    // Determine optimal grid configuration based on department count
    let cols = Math.ceil(Math.sqrt(departments.length))
    let rows = Math.ceil(departments.length / cols)
    
    // Adjust for better proportions
    if (departments.length <= 2) {
      cols = departments.length
      rows = 1
    } else if (departments.length <= 4) {
      cols = 2
      rows = 2
    } else if (departments.length <= 6) {
      cols = 3
      rows = 2
    }
    
    // Calculate zone dimensions
    const zoneWidth = Math.floor((availableWidth - (zonePadding * (cols - 1))) / cols)
    const zoneHeight = Math.floor((availableHeight - (zonePadding * (rows - 1))) / rows)
    
    // Ensure valid dimensions
    const safeZoneWidth = Math.max(200, Math.min(zoneWidth, availableWidth))
    const safeZoneHeight = Math.max(200, Math.min(zoneHeight, availableHeight))
    
    departments.forEach((dept, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      
      const x = usableArea.x + padding + (col * (safeZoneWidth + zonePadding))
      const y = usableArea.y + padding + (row * (safeZoneHeight + zonePadding))
      
      // Adjust size based on headcount proportion (slightly)
      const proportion = dept.headcount / totalHeadcount
      const adjustedWidth = Math.floor(safeZoneWidth * (0.8 + proportion * 0.4))
      const adjustedHeight = Math.floor(safeZoneHeight * (0.8 + proportion * 0.4))
      
      positions.push({
        x: Math.floor(x),
        y: Math.floor(y),
        width: Math.max(200, adjustedWidth),
        height: Math.max(200, adjustedHeight),
      })
    })
    
    return positions
  }

  private getUsableArea(dimensions: Dimensions): Rectangle {
    return {
      x: this.WALL_THICKNESS + this.PATHWAY_WIDTH,
      y: this.WALL_THICKNESS + this.PATHWAY_WIDTH,
      width: dimensions.width - (this.WALL_THICKNESS * 2) - (this.PATHWAY_WIDTH * 2),
      height: dimensions.height - (this.WALL_THICKNESS * 2) - (this.PATHWAY_WIDTH * 2),
    }
  }

  private findCollaborationZonePosition(zones: ZoneData[], usableArea: Rectangle): Rectangle | null {
    // Try to find a central position between zones
    if (zones.length < 2) return null
    
    const centerX = usableArea.x + usableArea.width / 2
    const centerY = usableArea.y + usableArea.height / 2
    
    const size = 200
    const proposed: Rectangle = {
      x: this.roundToTile(centerX - size / 2),
      y: this.roundToTile(centerY - size / 2),
      width: size,
      height: size,
    }
    
    // Check for collisions with existing zones
    const hasCollision = zones.some(zone => this.rectanglesOverlap(zone.bounds, proposed))
    
    if (!hasCollision) {
      return proposed
    }
    
    return null
  }

  private rectanglesOverlap(a: Rectangle, b: Rectangle): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    )
  }

  private getZoneRules(deptType: DepartmentType) {
    const baseRules = {
      allowHotDesks: false,
      focusMode: false,
      allowInteractions: ['wave', 'call', 'message', 'invite'] as const,
      notificationsEnabled: true,
    }
    
    switch (deptType) {
      case 'engineering':
        return {
          ...baseRules,
          focusMode: true,
          allowInteractions: ['wave', 'message', 'knock'] as const,
        }
      case 'sales':
        return {
          ...baseRules,
          allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'] as const,
        }
      case 'design':
        return {
          ...baseRules,
          allowInteractions: ['wave', 'call', 'message', 'invite', 'screen-share'] as const,
        }
      case 'leadership':
        return {
          ...baseRules,
          allowInteractions: ['knock', 'message', 'urgent'] as const,
        }
      default:
        return baseRules
    }
  }

  private formatDepartmentName(type: DepartmentType): string {
    const names: Record<DepartmentType, string> = {
      engineering: 'Engineering',
      design: 'Design',
      sales: 'Sales',
      marketing: 'Marketing',
      operations: 'Operations',
      leadership: 'Leadership',
      product: 'Product',
      hr: 'HR',
      finance: 'Finance',
      support: 'Support',
      custom: 'Team',
    }
    return names[type] || 'Team'
  }

  // ============================================
  // DESK GENERATION
  // ============================================

  private generateDesks(zones: ZoneData[], params: GenerationParams): DeskData[] {
    const desks: DeskData[] = []
    const deptHeadcounts = new Map<string, number>()
    
    params.departments.forEach(dept => {
      deptHeadcounts.set(dept.type, dept.headcount)
    })
    
    zones.forEach(zone => {
      if (!zone.departmentType) return
      
      const headcount = deptHeadcounts.get(zone.departmentType) || 0
      if (headcount === 0) return
      
      // Calculate how many desks fit in this zone
      const desksToPlace = this.calculateDesksInZone(zone, headcount, params)
      
      // Generate desk positions within the zone
      const zoneDesks = this.placeDeskGrid(zone, desksToPlace, params)
      desks.push(...zoneDesks)
    })
    
    return desks
  }

  private calculateDesksInZone(
    zone: ZoneData,
    headcount: number,
    params: GenerationParams
  ): { regular: number; hot: number } {
    const hotDeskRatio = params.includeHotDesks ? (params.hotDeskRatio || 0.2) : 0
    const regularDesks = Math.ceil(headcount * (1 - hotDeskRatio))
    const hotDesks = Math.floor(headcount * hotDeskRatio)
    
    return { regular: regularDesks, hot: hotDesks }
  }

  private placeDeskGrid(
    zone: ZoneData,
    deskCounts: { regular: number; hot: number },
    params: GenerationParams
  ): DeskData[] {
    const desks: DeskData[] = []
    const totalDesks = deskCounts.regular + deskCounts.hot
    
    if (totalDesks === 0) return desks
    
    // Professional desk dimensions and spacing
    const deskWidth = DESK_DEFAULTS.standard.width
    const deskHeight = DESK_DEFAULTS.standard.height
    
    // Very generous spacing for professional open office
    const padding = 100
    const horizontalSpacing = deskWidth + 180 // Extra wide aisles between columns
    const verticalSpacing = deskHeight + 220 // Very ample space for chairs and circulation
    
    // Calculate optimal grid configuration
    const availableWidth = zone.bounds.width - (padding * 2)
    const availableHeight = zone.bounds.height - (padding * 2) - 60 // Space for zone label
    
    const maxCols = Math.max(1, Math.floor(availableWidth / horizontalSpacing))
    const maxRows = Math.max(1, Math.floor(availableHeight / verticalSpacing))
    
    // Determine actual cols/rows needed
    let cols = Math.min(maxCols, Math.ceil(Math.sqrt(totalDesks * 1.5)))
    let rows = Math.ceil(totalDesks / cols)
    
    // Adjust if rows exceed max
    if (rows > maxRows) {
      rows = maxRows
      cols = Math.ceil(totalDesks / rows)
    }
    
    // Calculate starting positions to center the grid
    const gridWidth = cols * horizontalSpacing - (horizontalSpacing - deskWidth)
    const gridHeight = rows * verticalSpacing - (verticalSpacing - deskHeight)
    const startX = zone.bounds.x + (zone.bounds.width - gridWidth) / 2
    const startY = zone.bounds.y + 70 + (zone.bounds.height - gridHeight - 70) / 2
    
    let deskIndex = 0
    let hotDeskPlaced = 0
    
    for (let row = 0; row < rows && deskIndex < totalDesks; row++) {
      for (let col = 0; col < cols && deskIndex < totalDesks; col++) {
        const isHotDesk = hotDeskPlaced < deskCounts.hot
        if (isHotDesk) hotDeskPlaced++
        
        desks.push({
          id: `desk-${zone.id}-${deskIndex}`,
          position: {
            x: Math.floor(startX + col * horizontalSpacing),
            y: Math.floor(startY + row * verticalSpacing),
          },
          dimensions: { width: deskWidth, height: deskHeight },
          type: isHotDesk ? 'hotdesk' : 'standard',
          zoneId: zone.id,
          facing: row % 2 === 0 ? 'south' : 'north',
          isHotDesk,
          status: 'available',
        })
        
        deskIndex++
      }
    }
    
    return desks
  }

  // ============================================
  // ROOM GENERATION
  // ============================================

  private generateRooms(
    dimensions: Dimensions,
    params: GenerationParams,
    zones: ZoneData[]
  ): RoomData[] {
    const rooms: RoomData[] = []
    
    // Calculate room counts for professional office
    const meetingRoomCount = Math.max(4, Math.min(Math.floor(params.teamSize / 6) + 2, 8))
    const focusRoomCount = Math.max(3, Math.min(Math.floor(params.teamSize / 12), 6))
    const officeCount = Math.max(6, Math.min(Math.floor(params.teamSize / 5), 20)) // More offices - 1 per 5 people
    const chillRoomCount = Math.max(2, Math.min(Math.floor(params.teamSize / 15), 3))
    
    // Larger, more professional room dimensions
    const largeMeetingSize = { width: 320, height: 240 }
    const standardMeetingSize = { width: 280, height: 200 }
    const officeSize = { width: 180, height: 160 } // Individual office size
    const focusRoomSize = { width: 200, height: 180 }
    const loungeSize = { width: 360, height: 280 }
    const breakRoomSize = { width: 400, height: 300 }
    
    const edgePadding = 200
    const roomGap = 100
    
    // TOP RIGHT - Meeting Rooms (horizontal then vertical)
    let meetingX = dimensions.width - edgePadding
    let meetingY = edgePadding
    let meetingsInRow = 0
    const maxMeetingsPerRow = 2
    
    for (let i = 0; i < meetingRoomCount; i++) {
      const size = i < 2 ? largeMeetingSize : standardMeetingSize
      
      // Start new row after maxMeetingsPerRow
      if (meetingsInRow >= maxMeetingsPerRow) {
        meetingsInRow = 0
        meetingX = dimensions.width - edgePadding
        meetingY += (i < 2 ? largeMeetingSize.height : standardMeetingSize.height) + roomGap
      }
      
      const x = meetingX - size.width
      const y = meetingY
      
      if (y + size.height < dimensions.height - edgePadding) {
        rooms.push({
          id: `meeting-${String.fromCharCode(65 + i)}`,
          name: `Meeting Room ${String.fromCharCode(65 + i)}`,
          type: 'meeting',
          bounds: { x, y, width: size.width, height: size.height },
          capacity: i < 2 ? 12 : 8,
          equipment: ['projector', 'whiteboard', 'video-conference', 'screen', 'table', 'chairs'],
          bookable: true,
          status: 'available',
          color: ROOM_DEFAULTS.meeting.color,
          borderColor: ROOM_DEFAULTS.meeting.borderColor,
        })
        meetingX -= size.width + roomGap
        meetingsInRow++
      }
    }
    
    // TOP LEFT - Private Offices (grid layout along top edge)
    let officeX = edgePadding
    let officeY = edgePadding
    let officesPlaced = 0
    const maxOfficesPerRow = 6
    
    for (let i = 0; i < officeCount; i++) {
      // Move to next row if needed
      if (i > 0 && i % maxOfficesPerRow === 0) {
        officeX = edgePadding
        officeY += officeSize.height + roomGap
      }
      
      const x = officeX
      const y = officeY
      
      // Place office if there's space (stop before meeting rooms on right)
      if (x + officeSize.width < dimensions.width - edgePadding - largeMeetingSize.width * 2 - roomGap * 2 &&
          y + officeSize.height < dimensions.height - edgePadding) {
        rooms.push({
          id: `office-${i + 1}`,
          name: `Office ${i + 1}`,
          type: 'private',
          bounds: { x, y, width: officeSize.width, height: officeSize.height },
          capacity: 1,
          equipment: ['desk', 'chair', 'computer', 'phone', 'bookshelf'],
          bookable: false,
          status: 'available',
          color: '#e8f5e9',
          borderColor: '#4caf50',
        })
        officesPlaced++
      }
      
      officeX += officeSize.width + roomGap
    }
    
    // LEFT SIDE LOWER - Focus Rooms (stacked below offices)
    let focusX = edgePadding
    let focusY = officeY + officeSize.height + roomGap * 2
    
    for (let i = 0; i < focusRoomCount; i++) {
      if (focusY + focusRoomSize.height < dimensions.height - edgePadding - loungeSize.height - roomGap * 2) {
        rooms.push({
          id: `focus-${i + 1}`,
          name: `Focus Room ${i + 1}`,
          type: 'focus',
          bounds: { x: focusX, y: focusY, width: focusRoomSize.width, height: focusRoomSize.height },
          capacity: 3,
          equipment: ['whiteboard', 'desk', 'monitor', 'chair'],
          bookable: true,
          status: 'available',
          color: ROOM_DEFAULTS.focus.color,
          borderColor: ROOM_DEFAULTS.focus.borderColor,
        })
        focusY += focusRoomSize.height + roomGap
      }
    }
    
    // BOTTOM - Lounge/Chill Rooms (spread horizontally)
    let bottomLeftX = edgePadding
    const bottomY = dimensions.height - loungeSize.height - edgePadding
    
    for (let i = 0; i < chillRoomCount; i++) {
      if (bottomLeftX + loungeSize.width < dimensions.width / 2 - roomGap) {
        rooms.push({
          id: `lounge-${i + 1}`,
          name: i === 0 ? '🛋️ Lounge & Relaxation' : `Chill Zone ${i}`,
          type: 'break', // Use 'break' type instead of 'lounge'
          bounds: { x: bottomLeftX, y: bottomY, width: loungeSize.width, height: loungeSize.height },
          capacity: 12,
          equipment: ['sofa', 'armchairs', 'coffee-table', 'tv', 'games', 'plants'],
          bookable: false,
          status: 'available',
          color: '#f3e5f5',
          borderColor: '#9c27b0',
        })
        bottomLeftX += loungeSize.width + roomGap
      }
    }
    
    // BOTTOM RIGHT - Break Room / Kitchen
    const breakX = dimensions.width - breakRoomSize.width - edgePadding
    const breakY = dimensions.height - breakRoomSize.height - edgePadding
    
    rooms.push({
      id: 'break-room',
      name: '☕ Kitchen & Break Area',
      type: 'break',
      bounds: { x: breakX, y: breakY, width: breakRoomSize.width, height: breakRoomSize.height },
      capacity: 20,
      equipment: ['coffee-machine', 'espresso', 'fridge', 'microwave', 'sink', 'dishwasher', 'tables', 'chairs'],
      bookable: false,
      status: 'available',
      color: ROOM_DEFAULTS.break.color,
      borderColor: ROOM_DEFAULTS.break.borderColor,
    })
    
    return rooms
  }

  private calculateMeetingRoomCount(params: GenerationParams): number {
    let base = Math.max(1, Math.floor(params.teamSize / 8))
    
    if (params.collaboration === 'high') {
      base = Math.ceil(base * 1.5)
    } else if (params.collaboration === 'low') {
      base = Math.max(1, Math.floor(base * 0.7))
    }
    
    return Math.min(base, 6) // Cap at 6 meeting rooms
  }

  private findRoomPositions(
    dimensions: Dimensions,
    zones: ZoneData[],
    count: number,
    roomSize: Dimensions
  ): Position[] {
    const positions: Position[] = []
    const padding = this.WALL_THICKNESS + 20
    
    // Place rooms along the right and bottom edges
    const rightX = dimensions.width - roomSize.width - padding
    const bottomY = dimensions.height - roomSize.height - padding
    
    // Right edge positions
    for (let i = 0; i < Math.ceil(count / 2) && positions.length < count; i++) {
      positions.push({
        x: rightX,
        y: padding + i * (roomSize.height + 30),
      })
    }
    
    // Bottom edge positions
    for (let i = 0; i < Math.floor(count / 2) && positions.length < count; i++) {
      positions.push({
        x: padding + i * (roomSize.width + 30),
        y: bottomY,
      })
    }
    
    return positions
  }

  private findPhoneBoothPosition(
    dimensions: Dimensions,
    zones: ZoneData[],
    existingRooms: RoomData[],
    index: number
  ): Position | null {
    const boothSize = 80
    const padding = this.WALL_THICKNESS + 20
    
    // Place phone booths along the top edge
    const x = padding + index * (boothSize + 40)
    const y = padding
    
    if (x + boothSize < dimensions.width - padding) {
      return { x, y }
    }
    
    return null
  }

  private findBreakRoomPosition(
    dimensions: Dimensions,
    zones: ZoneData[],
    existingRooms: RoomData[]
  ): Position | null {
    const padding = this.WALL_THICKNESS + 20
    
    // Place break room in bottom-right corner
    return {
      x: dimensions.width - 220 - padding,
      y: dimensions.height - 170 - padding,
    }
  }

  private findFocusRoomPosition(
    dimensions: Dimensions,
    zones: ZoneData[],
    existingRooms: RoomData[],
    index: number
  ): Position | null {
    const roomSize = { width: 120, height: 100 }
    const padding = this.WALL_THICKNESS + 20
    
    // Place focus rooms along the left edge
    const x = padding
    const y = dimensions.height / 2 + index * (roomSize.height + 30)
    
    if (y + roomSize.height < dimensions.height - padding) {
      return { x, y }
    }
    
    return null
  }

  // ============================================
  // PATHWAY GENERATION
  // ============================================

  private generatePathways(dimensions: Dimensions, zones: ZoneData[]): PathwayData[] {
    const pathways: PathwayData[] = []
    
    // Main horizontal corridor
    const centerY = dimensions.height / 2
    pathways.push({
      id: 'main-corridor-h',
      points: [
        { x: this.WALL_THICKNESS, y: centerY },
        { x: dimensions.width - this.WALL_THICKNESS, y: centerY },
      ],
      width: this.PATHWAY_WIDTH,
      isMainCorridor: true,
    })
    
    // Main vertical corridor
    const centerX = dimensions.width / 2
    pathways.push({
      id: 'main-corridor-v',
      points: [
        { x: centerX, y: this.WALL_THICKNESS },
        { x: centerX, y: dimensions.height - this.WALL_THICKNESS },
      ],
      width: this.PATHWAY_WIDTH,
      isMainCorridor: true,
    })
    
    return pathways
  }

  // ============================================
  // WALL GENERATION
  // ============================================

  private generateWalls(dimensions: Dimensions, rooms: RoomData[]): WallData[] {
    const walls: WallData[] = []
    const thickness = this.WALL_THICKNESS
    
    // Outer walls
    walls.push(
      // Top
      {
        id: 'wall-top',
        start: { x: 0, y: 0 },
        end: { x: dimensions.width, y: 0 },
        thickness,
      },
      // Bottom
      {
        id: 'wall-bottom',
        start: { x: 0, y: dimensions.height - thickness },
        end: { x: dimensions.width, y: dimensions.height - thickness },
        thickness,
      },
      // Left
      {
        id: 'wall-left',
        start: { x: 0, y: 0 },
        end: { x: 0, y: dimensions.height },
        thickness,
      },
      // Right
      {
        id: 'wall-right',
        start: { x: dimensions.width - thickness, y: 0 },
        end: { x: dimensions.width - thickness, y: dimensions.height },
        thickness,
      }
    )
    
    return walls
  }

  // ============================================
  // DECORATION GENERATION
  // ============================================

  private generateDecorations(
    dimensions: Dimensions,
    zones: ZoneData[],
    culture: string
  ): DecorationData[] {
    const decorations: DecorationData[] = []
    
    // Add plants around the office
    const plantCount = Math.max(4, Math.floor((dimensions.width * dimensions.height) / 100000))
    
    for (let i = 0; i < plantCount; i++) {
      const plantType: DecorationType = i % 3 === 0 ? 'plant-large' : i % 2 === 0 ? 'plant-medium' : 'plant-small'
      const size = DECORATION_SIZES[plantType]
      
      decorations.push({
        id: `plant-${i}`,
        type: plantType,
        position: this.findDecorationPosition(dimensions, zones, decorations, size),
        dimensions: size,
      })
    }
    
    // Add whiteboards near engineering zones
    zones.filter(z => z.departmentType === 'engineering' || z.departmentType === 'design').forEach((zone, i) => {
      decorations.push({
        id: `whiteboard-${i}`,
        type: 'whiteboard',
        position: {
          x: zone.bounds.x + zone.bounds.width - 100,
          y: zone.bounds.y + 40,
        },
        dimensions: DECORATION_SIZES.whiteboard,
        interactive: true,
        interactionRadius: 100,
      })
    })
    
    // Add coffee machines near break areas
    decorations.push({
      id: 'coffee-machine-1',
      type: 'coffee-machine',
      position: {
        x: dimensions.width - 150,
        y: dimensions.height - 120,
      },
      dimensions: DECORATION_SIZES['coffee-machine'],
      interactive: true,
      interactionRadius: 80,
    })
    
    // Culture-specific decorations
    if (culture === 'startup' || culture === 'creative') {
      decorations.push({
        id: 'bean-bag-1',
        type: 'bean-bag',
        position: {
          x: dimensions.width / 2 - 50,
          y: dimensions.height / 2 - 50,
        },
        dimensions: DECORATION_SIZES['bean-bag'],
      })
    }
    
    return decorations
  }

  private findDecorationPosition(
    dimensions: Dimensions,
    zones: ZoneData[],
    existingDecorations: DecorationData[],
    size: Dimensions
  ): Position {
    // Simple corner and edge placement
    const padding = this.WALL_THICKNESS + 20
    const positions: Position[] = [
      { x: padding, y: padding },
      { x: dimensions.width - size.width - padding, y: padding },
      { x: padding, y: dimensions.height - size.height - padding },
      { x: dimensions.width - size.width - padding, y: dimensions.height - size.height - padding },
      { x: dimensions.width / 2 - size.width / 2, y: padding },
      { x: dimensions.width / 2 - size.width / 2, y: dimensions.height - size.height - padding },
    ]
    
    const usedPositions = existingDecorations.map(d => d.position)
    const availablePos = positions.find(pos => 
      !usedPositions.some(used => 
        Math.abs(used.x - pos.x) < size.width && Math.abs(used.y - pos.y) < size.height
      )
    )
    
    return availablePos || positions[existingDecorations.length % positions.length]
  }

  // ============================================
  // SPAWN POINT GENERATION
  // ============================================

  private generateSpawnPoints(dimensions: Dimensions, zones: ZoneData[]): SpawnPoint[] {
    const spawnPoints: SpawnPoint[] = []
    
    // Default spawn point (center of office)
    spawnPoints.push({
      id: 'spawn-default',
      position: {
        x: dimensions.width / 2,
        y: dimensions.height / 2,
      },
      type: 'default',
    })
    
    // Department-specific spawn points
    zones.forEach(zone => {
      if (zone.departmentType) {
        spawnPoints.push({
          id: `spawn-${zone.id}`,
          position: {
            x: zone.bounds.x + zone.bounds.width / 2,
            y: zone.bounds.y + zone.bounds.height / 2,
          },
          type: 'department',
          departmentType: zone.departmentType,
        })
      }
    })
    
    return spawnPoints
  }

  // ============================================
  // METRICS CALCULATION
  // ============================================

  private calculateMetrics(layout: OfficeLayoutData): LayoutMetrics {
    const totalArea = layout.dimensions.width * layout.dimensions.height
    
    return {
      totalArea,
      deskCount: layout.desks.length,
      hotDeskCount: layout.desks.filter(d => d.isHotDesk).length,
      roomCount: layout.rooms.length,
      zoneCount: layout.zones.length,
      walkabilityScore: this.calculateWalkabilityScore(layout),
      collaborationScore: this.calculateCollaborationScore(layout),
      privacyScore: this.calculatePrivacyScore(layout),
      utilizationEstimate: this.calculateUtilizationEstimate(layout),
    }
  }

  private calculateWalkabilityScore(layout: OfficeLayoutData): number {
    // Simplified walkability score based on pathway coverage
    const pathwayArea = layout.pathways.reduce((sum, p) => {
      const length = Math.sqrt(
        Math.pow(p.points[1].x - p.points[0].x, 2) +
        Math.pow(p.points[1].y - p.points[0].y, 2)
      )
      return sum + length * p.width
    }, 0)
    
    const totalArea = layout.dimensions.width * layout.dimensions.height
    const pathwayRatio = pathwayArea / totalArea
    
    // Score 0-100, optimal is around 15-25% pathway coverage
    if (pathwayRatio < 0.10) return 60
    if (pathwayRatio > 0.30) return 70
    return 85 + (1 - Math.abs(0.20 - pathwayRatio) / 0.20) * 15
  }

  private calculateCollaborationScore(layout: OfficeLayoutData): number {
    const meetingRooms = layout.rooms.filter(r => r.type === 'meeting')
    const collabZones = layout.zones.filter(z => z.type === 'collaboration')
    
    const meetingCapacity = meetingRooms.reduce((sum, r) => sum + r.capacity, 0)
    const teamSize = layout.metadata.teamSize
    
    // Score based on meeting room capacity per person
    const capacityRatio = meetingCapacity / teamSize
    
    let score = 70
    if (capacityRatio >= 0.8) score += 20
    else if (capacityRatio >= 0.5) score += 10
    
    if (collabZones.length > 0) score += 10
    
    return Math.min(100, score)
  }

  private calculatePrivacyScore(layout: OfficeLayoutData): number {
    const focusRooms = layout.rooms.filter(r => r.type === 'focus' || r.type === 'phone-booth')
    const focusZones = layout.zones.filter(z => z.rules.focusMode)
    
    const focusCapacity = focusRooms.reduce((sum, r) => sum + r.capacity, 0)
    const teamSize = layout.metadata.teamSize
    
    let score = 60
    if (focusCapacity / teamSize >= 0.15) score += 25
    else if (focusCapacity / teamSize >= 0.08) score += 15
    
    if (focusZones.length > 0) score += 15
    
    return Math.min(100, score)
  }

  private calculateUtilizationEstimate(layout: OfficeLayoutData): number {
    // Estimated space utilization based on desk density and room distribution
    const deskArea = layout.desks.length * 100 * 80 // Approximate desk + chair area
    const roomArea = layout.rooms.reduce((sum, r) => sum + r.bounds.width * r.bounds.height, 0)
    const totalArea = layout.dimensions.width * layout.dimensions.height
    
    const usedArea = deskArea + roomArea
    const utilizationRatio = usedArea / totalArea
    
    // Optimal utilization is 40-60%
    if (utilizationRatio < 0.30) return 65
    if (utilizationRatio > 0.70) return 70
    return 80 + (1 - Math.abs(0.50 - utilizationRatio) / 0.50) * 20
  }

  // ============================================
  // REASONING GENERATION
  // ============================================

  private generateReasoning(params: GenerationParams, metrics: LayoutMetrics): string {
    const parts: string[] = []
    
    parts.push(`Based on your team of ${params.teamSize} people, I've created an optimized office layout.`)
    
    // Department reasoning
    if (params.departments.length > 1) {
      const deptNames = params.departments.map(d => this.formatDepartmentName(d.type))
      parts.push(`I've positioned ${deptNames.join(', ')} teams in dedicated zones to support their workflows.`)
    }
    
    // Collaboration reasoning
    if (params.collaboration === 'high') {
      parts.push(`Given your high collaboration needs, I've added ${metrics.roomCount} meeting spaces and positioned teams for easy interaction.`)
    } else if (params.collaboration === 'low') {
      parts.push(`Since your team prefers independent work, I've included focus rooms and quiet zones.`)
    }
    
    // Work style reasoning
    if (params.workStyle === 'hybrid' || params.workStyle === 'remote-first') {
      parts.push(`For your ${params.workStyle} work style, I've included ${metrics.hotDeskCount} hot desks for flexibility.`)
    }
    
    // Culture reasoning
    if (params.culture === 'startup') {
      parts.push(`The startup vibe is reflected in an open floor plan with casual collaboration spaces.`)
    } else if (params.culture === 'corporate') {
      parts.push(`The layout maintains a professional structure with clear department boundaries.`)
    }
    
    return parts.join(' ')
  }
}

// ============================================
// HELPER TYPES
// ============================================

interface SpaceAllocation {
  desks: number
  meetings: number
  social: number
  circulation: number
  special: number
}
