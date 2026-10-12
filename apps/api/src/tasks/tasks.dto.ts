/** Validated request bodies for creating and updating tasks (class-validator; see tasks.controller.ts). */
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TaskPriority, TaskStatus, TaskType } from '@prisma/client';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value));

/** Request payload for creating a new task in a workspace column with validated bounds. */
export class CreateTaskDto {
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @trim()
  @IsString()
  @Length(1, 200, { message: 'Give the task a title (200 characters at most).' })
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Description must be at most 5000 characters.' })
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  dueDate?: string | null;
}

/** Request payload for updating an existing task's status, assignment, ranking, or details. */
export class UpdateTaskDto {
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @IsOptional()
  @trim()
  @IsString()
  @Length(1, 200, { message: 'Give the task a title (200 characters at most).' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Description must be at most 5000 characters.' })
  description?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  dueDate?: string | null;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  rank?: number;
}
