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

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value));

export class CreateWorkspaceDto {
  @trim()
  @IsString()
  @Length(2, 40, { message: 'Office name must be 2 to 40 characters.' })
  name: string;

  @IsString()
  @IsIn(TEMPLATES.map((t) => t.id))
  templateId: string;

  /** The generated office needs it: how many people it's made for. */
  @ValidateIf((o: CreateWorkspaceDto) => o.templateId === 'generated' || o.teamSize !== undefined)
  @IsInt({ message: 'Pick the size of your team.' })
  @Min(1)
  @Max(100)
  teamSize?: number;

  @IsCharacter()
  character: string;
}

export class SwitchTemplateDto {
  @IsString()
  @IsIn(TEMPLATES.map((t) => t.id))
  templateId: string;

  /** For the generated office; the number of members when left out. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  teamSize?: number;

  /** The layout version the organiser saw: refused if someone saved since. */
  @IsInt()
  @Min(1)
  version: number;
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
  @IsCharacter()
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
  @IsCharacter()
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

export class WingDto {
  @IsIn(['LEFT', 'RIGHT', 'BOTTOM'])
  side: 'LEFT' | 'RIGHT' | 'BOTTOM';

  @IsInt()
  version: number;
}

export class MyDeskDto {
  @IsString()
  @MaxLength(100)
  deskId: string;
}

