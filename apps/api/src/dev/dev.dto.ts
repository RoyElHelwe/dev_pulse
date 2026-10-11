/**
 * Dev/test only data transfer objects.
 * Validates request bodies for the dev identity switcher and throwaway user creation endpoints.
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

const MAX_DEV_USER_ID_LENGTH = 64;
const MAX_DEV_NAME_LENGTH = 60;
const MAX_DEV_JOIN_USER_ID_LENGTH = 64;

/** Body of POST /auth/dev/login for selecting an existing user account in dev mode. */
export class DevLoginDto {
  @IsString()
  @MaxLength(MAX_DEV_USER_ID_LENGTH)
  userId!: string;
}

/** Body of POST /auth/dev/users for provisioning a throwaway test user. */
export class DevUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DEV_NAME_LENGTH)
  name?: string;

  /** Join the office of this user (so the new user lands in the same office). */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DEV_JOIN_USER_ID_LENGTH)
  joinUserId?: string;
}

