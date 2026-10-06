import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DevLoginDto {
  @IsString()
  @MaxLength(64)
  userId!: string;
}

export class DevUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  /** Join the office of this user (so the new user lands in the same office). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  joinUserId?: string;
}
