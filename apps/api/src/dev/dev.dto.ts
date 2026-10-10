/**
 * Dev/test only: request bodies of the dev sign-in routes (see dev.controller.ts).
 * Never active in production: DevModule is not even loaded there (see dev.module.ts).
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Body of POST /auth/dev/login. */
export class DevLoginDto {
  @IsString()
  @MaxLength(64)
  userId!: string;
}

/** Body of POST /auth/dev/users. */
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
