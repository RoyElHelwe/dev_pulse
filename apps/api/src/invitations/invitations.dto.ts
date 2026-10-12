/**
 * Data transfer objects for workspace member invitation endpoints.
 * Validates recipient email format and assigned organizational role.
 */

import { IsIn } from 'class-validator';
import { IsEmailField } from '../auth/dto/validation';

/** Request payload for inviting a new member or admin to join an office workspace. */
export class InviteDto {
  @IsEmailField()
  email: string;

  @IsIn(['ADMIN', 'MEMBER'])
  role: 'ADMIN' | 'MEMBER';
}

