/**
 * Data transfer objects and validation schemas for workspace creation,
 * layout editing, template switching, and desk assignments.
 */

import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { FURNITURE_KINDS } from '../office/layout/types';
import { TEMPLATES } from '../office/templates';
import { IsCharacter } from './characters';

const MIN_WORKSPACE_NAME_LENGTH = 2;
const MAX_WORKSPACE_NAME_LENGTH = 40;
const MIN_TEAM_SIZE = 1;
const MAX_TEAM_SIZE = 100;
const MIN_LAYOUT_VERSION = 1;
const MAX_STATUS_LENGTH = 40;
const MIN_ID_LENGTH = 1;
const MAX_ID_LENGTH = 40;
const MAX_DESK_ID_LENGTH = 100;
const MIN_ROOM_NAME_LENGTH = 1;
const MAX_ROOM_NAME_LENGTH = 24;
const MAX_FURNITURE_COORD = 200;
const MIN_FURNITURE_DIM = 0.1;
const MAX_FURNITURE_DIM = 12;
const MAX_COLOR_HEX = 0xffffff;
const MAX_FURNITURE_COUNT = 600;
const MAX_ROOMS_COUNT = 50;

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value));

/** Payload for initializing a new office workspace and owner membership. */
export class CreateWorkspaceDto {
  @trim()
  @IsString()
  @Length(MIN_WORKSPACE_NAME_LENGTH, MAX_WORKSPACE_NAME_LENGTH, { message: 'Office name must be 2 to 40 characters.' })
  name: string;

  @IsString()
  @IsIn(TEMPLATES.map((t) => t.id))
  templateId: string;

  /** The generated office needs it: how many people it's made for. */
  @ValidateIf((o: CreateWorkspaceDto) => o.templateId === 'generated' || o.teamSize !== undefined)
  @IsInt({ message: 'Pick the size of your team.' })
  @Min(MIN_TEAM_SIZE)
  @Max(MAX_TEAM_SIZE)
  teamSize?: number;

  @IsCharacter()
  character: string;
}

/** Payload for changing an existing workspace to a different office layout template. */
export class SwitchTemplateDto {
  @IsString()
  @IsIn(TEMPLATES.map((t) => t.id))
  templateId: string;

  /** For the generated office; the number of members when left out. */
  @IsOptional()
  @IsInt()
  @Min(MIN_TEAM_SIZE)
  @Max(MAX_TEAM_SIZE)
  teamSize?: number;

  /** The layout version the organiser saw: refused if someone saved since. */
  @IsInt()
  @Min(MIN_LAYOUT_VERSION)
  version: number;
}

/** Payload for renaming an existing workspace. */
export class RenameWorkspaceDto {
  @trim()
  @IsString()
  @Length(MIN_WORKSPACE_NAME_LENGTH, MAX_WORKSPACE_NAME_LENGTH, { message: 'Office name must be 2 to 40 characters.' })
  name: string;
}

/** Payload for updating the calling member's avatar character and status. */
export class UpdateMeDto {
  @IsOptional()
  @IsCharacter()
  character?: string;

  /** Empty = no status. */
  @IsOptional()
  @trim()
  @IsString()
  @Length(0, MAX_STATUS_LENGTH, { message: 'A status is 40 characters at most.' })
  status?: string;
}

/** Payload for accepting a workspace invitation with an optional avatar selection. */
export class AcceptInvitationDto {
  @IsOptional()
  @IsCharacter()
  character?: string;
}

/** Payload for assigning or clearing a member's assigned desk identifier. */
export class DeskDto {
  /** A desk id, or null for "no desk". */
  @IsOptional()
  @IsString()
  @Length(MIN_ID_LENGTH, MAX_ID_LENGTH)
  deskId: string | null;
}

/** Item attributes and bounding box representing a piece of office furniture. */
class FurnitureDto {
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,40}$/)
  id: string;

  @IsIn(FURNITURE_KINDS)
  kind: (typeof FURNITURE_KINDS)[number];

  @IsNumber()
  @Min(0)
  @Max(MAX_FURNITURE_COORD)
  x: number;

  @IsNumber()
  @Min(0)
  @Max(MAX_FURNITURE_COORD)
  y: number;

  @IsNumber()
  @Min(MIN_FURNITURE_DIM)
  @Max(MAX_FURNITURE_DIM)
  w: number;

  @IsNumber()
  @Min(MIN_FURNITURE_DIM)
  @Max(MAX_FURNITURE_DIM)
  h: number;

  @IsOptional()
  @IsIn([0, 90, 180, 270])
  rotation?: 0 | 90 | 180 | 270;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_COLOR_HEX)
  color?: number;
}

/** Identifier and display name mapping for an office room. */
class RoomNameDto {
  @IsString()
  @Length(MIN_ID_LENGTH, MAX_ID_LENGTH)
  id: string;

  @trim()
  @IsString()
  @Length(MIN_ROOM_NAME_LENGTH, MAX_ROOM_NAME_LENGTH, { message: 'Room names must be 1 to 24 characters.' })
  name: string;
}

/** Payload containing modified furniture items and room labels for a layout revision. */
export class UpdateLayoutDto {
  @IsInt()
  @Min(MIN_LAYOUT_VERSION)
  version: number;

  @IsArray()
  @ArrayMaxSize(MAX_FURNITURE_COUNT)
  @ValidateNested({ each: true })
  @Type(() => FurnitureDto)
  furniture: FurnitureDto[];

  @IsArray()
  @ArrayMaxSize(MAX_ROOMS_COUNT)
  @ValidateNested({ each: true })
  @Type(() => RoomNameDto)
  rooms: RoomNameDto[];
}

/** Payload specifying the side and expected layout version for adding an office wing. */
export class WingDto {
  @IsIn(['LEFT', 'RIGHT', 'BOTTOM'])
  side: 'LEFT' | 'RIGHT' | 'BOTTOM';

  @IsInt()
  version: number;
}

/** Payload for a member moving themselves to a target desk identifier. */
export class MyDeskDto {
  @IsString()
  @MaxLength(MAX_DESK_ID_LENGTH)
  deskId: string;
}


