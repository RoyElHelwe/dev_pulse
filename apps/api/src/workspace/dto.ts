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
  Min,
  ValidateNested,
} from 'class-validator';
import { FURNITURE_KINDS } from '../office/layout/types';
import { CHARACTERS } from './characters';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value));

export class CreateWorkspaceDto {
  @trim()
  @IsString()
  @Length(2, 40, { message: 'Office name must be 2 to 40 characters.' })
  name: string;

  @IsString()
  @IsIn(['loft', 'studio', 'campus'])
  templateId: string;

  @IsIn(CHARACTERS)
  character: string;
}

export class RenameWorkspaceDto {
  @trim()
  @IsString()
  @Length(2, 40, { message: 'Office name must be 2 to 40 characters.' })
  name: string;
}

/** What a member changes about themselves in the office. */
export class UpdateMeDto {
  @IsOptional()
  @IsIn(CHARACTERS)
  character?: string;

  /** Empty = no status. */
  @IsOptional()
  @trim()
  @IsString()
  @Length(0, 40, { message: 'A status is 40 characters at most.' })
  status?: string;
}

export class AcceptInvitationDto {
  @IsOptional()
  @IsIn(CHARACTERS)
  character?: string;
}

export class DeskDto {
  /** A desk id, or null for "no desk". */
  @IsOptional()
  @IsString()
  @Length(1, 40)
  deskId: string | null;
}

export class FurnitureDto {
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,40}$/)
  id: string;

  @IsIn(FURNITURE_KINDS)
  kind: (typeof FURNITURE_KINDS)[number];

  @IsNumber()
  @Min(0)
  @Max(200)
  x: number;

  @IsNumber()
  @Min(0)
  @Max(200)
  y: number;

  @IsNumber()
  @Min(0.1)
  @Max(12)
  w: number;

  @IsNumber()
  @Min(0.1)
  @Max(12)
  h: number;

  @IsOptional()
  @IsIn([0, 90, 180, 270])
  rotation?: 0 | 90 | 180 | 270;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(0xffffff)
  color?: number;
}

export class RoomNameDto {
  @IsString()
  @Length(1, 40)
  id: string;

  @trim()
  @IsString()
  @Length(1, 24, { message: 'Room names must be 1 to 24 characters.' })
  name: string;
}

/** What the office editor may change: furniture and room names (walls and rooms stay). */
export class UpdateLayoutDto {
  @IsInt()
  @Min(1)
  version: number;

  @IsArray()
  @ArrayMaxSize(600)
  @ValidateNested({ each: true })
  @Type(() => FurnitureDto)
  furniture: FurnitureDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RoomNameDto)
  rooms: RoomNameDto[];
}
