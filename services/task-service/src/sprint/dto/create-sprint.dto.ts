import { IsString, IsOptional, IsDateString, MinLength, MaxLength } from 'class-validator';

export class CreateSprintDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  goal?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
