/**
 * Office Layout DTOs
 * 
 * Data Transfer Objects for office layout API endpoints
 * Synced with @dev-pulse/shared-types
 */

import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  IsObject,
  ValidateNested,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// ENUMS (synced with @dev-pulse/shared-types)
// ============================================

export enum GenerationMode {
  AI_AUTO = 'AI_AUTO',
  TEMPLATE = 'TEMPLATE',
  MANUAL = 'MANUAL',
  HYBRID = 'HYBRID',
}

export enum TemplateCategory {
  STARTUP = 'STARTUP',
  CORPORATE = 'CORPORATE',
  CREATIVE = 'CREATIVE',
  REMOTE_HUB = 'REMOTE_HUB',
  ENTERPRISE = 'ENTERPRISE',
  HYBRID = 'HYBRID',
}

export type DeskType = 'standard' | 'standing' | 'hotdesk' | 'hot' | 'executive' | 'l-shaped';
export type DeskStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';
export type RoomType = 'meeting' | 'phone-booth' | 'phone' | 'focus' | 'conference' | 'break' | 'private' | 'huddle';
export type RoomStatus = 'available' | 'in-use' | 'reserved' | 'maintenance';
export type Direction = 'north' | 'south' | 'east' | 'west';
export type ZoneType = 'engineering' | 'design' | 'sales' | 'marketing' | 'operations' | 'leadership' | 'product' | 'hr' | 'finance' | 'support' | 'custom' | 'collaboration' | 'focus' | 'social' | 'reception';
export type InteractionType = 'wave' | 'call' | 'message' | 'invite' | 'knock' | 'urgent' | 'screen-share';
export type SpawnPointType = 'default' | 'department' | 'visitor';

// ============================================
// BASE TYPES (synced with @dev-pulse/shared-types)
// ============================================

export class PositionDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class DimensionsDto {
  @IsNumber()
  @Min(1)
  width!: number;

  @IsNumber()
  @Min(1)
  height!: number;
}

export class RectangleDto extends PositionDto {
  @IsNumber()
  @Min(1)
  width!: number;

  @IsNumber()
  @Min(1)
  height!: number;
}

// ============================================
// ZONE DTOs
// ============================================

export class ZoneRulesDto {
  @IsBoolean()
  allowHotDesks!: boolean;

  @IsBoolean()
  focusMode!: boolean;

  @IsArray()
  @IsString({ each: true })
  allowInteractions!: InteractionType[];

  @IsBoolean()
  notificationsEnabled!: boolean;

  @IsOptional()
  @IsNumber()
  maxOccupancy?: number;
}

export class ZoneDataDto {
  @IsString()
  id!: string;

  @IsString()
  type!: ZoneType;

  @IsString()
  name!: string;

  @ValidateNested()
  @Type(() => RectangleDto)
  bounds!: RectangleDto;

  @IsString()
  color!: string;

  @IsOptional()
  @IsString()
  departmentType?: string;

  @ValidateNested()
  @Type(() => ZoneRulesDto)
  rules!: ZoneRulesDto;
}

// ============================================
// DESK DTOs
// ============================================

export class DeskDataDto {
  @IsString()
  id!: string;

  @ValidateNested()
  @Type(() => PositionDto)
  position!: PositionDto;

  @ValidateNested()
  @Type(() => DimensionsDto)
  dimensions!: DimensionsDto;

  @IsString()
  type!: DeskType;

  @IsString()
  zoneId!: string;

  @IsString()
  facing!: Direction;

  @IsBoolean()
  isHotDesk!: boolean;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  assignedUserName?: string;

  @IsString()
  status!: DeskStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipment?: string[];

  @IsOptional()
  @IsString()
  color?: string;
}

// ============================================
// ROOM DTOs
// ============================================

export class RoomDataDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  type!: RoomType;

  @ValidateNested()
  @Type(() => RectangleDto)
  bounds!: RectangleDto;

  @IsNumber()
  @Min(1)
  capacity!: number;

  @IsArray()
  @IsString({ each: true })
  equipment!: string[];

  @IsBoolean()
  bookable!: boolean;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsString()
  status!: RoomStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentOccupants?: string[];

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  borderColor?: string;
}

// ============================================
// DECORATION DTOs
// ============================================

export class DecorationDataDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @ValidateNested()
  @Type(() => PositionDto)
  position!: PositionDto;

  @ValidateNested()
  @Type(() => DimensionsDto)
  dimensions!: DimensionsDto;

  @IsOptional()
  @IsNumber()
  rotation?: number;

  @IsOptional()
  @IsBoolean()
  interactive?: boolean;

  @IsOptional()
  @IsNumber()
  interactionRadius?: number;
}

// ============================================
// WALL DTOs
// ============================================

export class WallDataDto {
  @IsString()
  id!: string;

  @ValidateNested()
  @Type(() => PositionDto)
  start!: PositionDto;

  @ValidateNested()
  @Type(() => PositionDto)
  end!: PositionDto;

  @IsNumber()
  @Min(1)
  thickness!: number;

  @IsOptional()
  @IsBoolean()
  hasWindow?: boolean;

  @IsOptional()
  @IsBoolean()
  hasDoor?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PositionDto)
  doorPosition?: PositionDto;
}

// ============================================
// SPAWN POINT DTOs
// ============================================

export class SpawnPointDto {
  @IsString()
  id!: string;

  @ValidateNested()
  @Type(() => PositionDto)
  position!: PositionDto;

  @IsString()
  type!: SpawnPointType;

  @IsOptional()
  @IsString()
  departmentType?: string;
}

// ============================================
// PATHWAY DTOs
// ============================================

export class PathwayDataDto {
  @IsString()
  id!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionDto)
  points!: PositionDto[];

  @IsNumber()
  @Min(1)
  width!: number;

  @IsBoolean()
  isMainCorridor!: boolean;
}

// ============================================
// LAYOUT METADATA DTOs
// ============================================

export class LayoutMetadataDto {
  @IsString()
  version!: string;

  @IsString()
  generatedAt!: string;

  @IsEnum(GenerationMode)
  mode!: GenerationMode;

  @IsNumber()
  @Min(1)
  teamSize!: number;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  aiPrompt?: string;

  @IsOptional()
  @IsString()
  aiReasoning?: string;

  @IsOptional()
  @IsNumber()
  optimizationScore?: number;
}

// ============================================
// LAYOUT METRICS DTOs
// ============================================

export class LayoutMetricsDto {
  @IsNumber()
  totalArea!: number;

  @IsNumber()
  deskCount!: number;

  @IsNumber()
  hotDeskCount!: number;

  @IsNumber()
  roomCount!: number;

  @IsNumber()
  zoneCount!: number;

  @IsOptional()
  @IsNumber()
  walkabilityScore?: number;

  @IsOptional()
  @IsNumber()
  collaborationScore?: number;

  @IsOptional()
  @IsNumber()
  privacyScore?: number;

  @IsOptional()
  @IsNumber()
  utilizationEstimate?: number;
}

// ============================================
// FULL LAYOUT DATA DTO
// ============================================

export class LayoutDataDto {
  @ValidateNested()
  @Type(() => LayoutMetadataDto)
  metadata!: LayoutMetadataDto;

  @ValidateNested()
  @Type(() => DimensionsDto)
  dimensions!: DimensionsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ZoneDataDto)
  zones!: ZoneDataDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeskDataDto)
  desks!: DeskDataDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomDataDto)
  rooms!: RoomDataDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DecorationDataDto)
  decorations!: DecorationDataDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WallDataDto)
  walls!: WallDataDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpawnPointDto)
  spawnPoints!: SpawnPointDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PathwayDataDto)
  pathways!: PathwayDataDto[];
}

// ============================================
// CREATE/UPDATE LAYOUT DTOs
// ============================================

export class CreateOfficeLayoutDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsEnum(GenerationMode)
  generationMode!: GenerationMode;

  @ValidateNested()
  @Type(() => LayoutDataDto)
  layoutData!: LayoutDataDto;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  generationParams?: Record<string, any>;
}

export class UpdateOfficeLayoutDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(GenerationMode)
  generationMode?: GenerationMode;

  @IsOptional()
  @ValidateNested()
  @Type(() => LayoutDataDto)
  layoutData?: LayoutDataDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ============================================
// DESK ASSIGNMENT DTOs
// ============================================

export class CreateDeskAssignmentDto {
  @IsString()
  deskId!: string;

  @IsString()
  userId!: string;

  @IsOptional()
  @IsBoolean()
  isPermanent?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateDeskAssignmentDto {
  @IsOptional()
  @IsBoolean()
  isHotDesk?: boolean;

  @IsOptional()
  @IsDateString()
  reservedFrom?: string;

  @IsOptional()
  @IsDateString()
  reservedTo?: string;
}

// ============================================
// MEETING ROOM BOOKING DTOs
// ============================================

export class CreateMeetingBookingDto {
  @IsString()
  roomId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attendeeIds?: string[];

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  recurringRule?: string;
}

export class UpdateMeetingBookingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attendeeIds?: string[];
}

// ============================================
// QUERY DTOs
// ============================================

export class GetLayoutsQueryDto {
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;
}

export class GetBookingsQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class GetDeskAssignmentsQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  deskId?: string;

  @IsOptional()
  @IsBoolean()
  isHotDesk?: boolean;
}
