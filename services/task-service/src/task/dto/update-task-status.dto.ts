import { IsEnum, IsOptional, IsNumber } from 'class-validator';

export enum TaskStatusDto {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE',
}

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatusDto)
  status!: TaskStatusDto;

  @IsOptional()
  @IsNumber()
  position?: number;
}
