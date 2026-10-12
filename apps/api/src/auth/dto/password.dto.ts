/**
 * Password change and reset data transfer objects.
 * Validates reset token payloads and new password submissions.
 */
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IsNewPassword } from './validation';

const MIN_RESET_TOKEN_LENGTH = 20;
const MAX_RESET_TOKEN_LENGTH = 200;
const MAX_PASSWORD_LENGTH = 128;

/** Request body payload for completing a password reset via email link token. */
export class ResetPasswordDto {
  @IsString()
  @Length(MIN_RESET_TOKEN_LENGTH, MAX_RESET_TOKEN_LENGTH)
  token: string;

  @IsNewPassword()
  password: string;
}

/** Request body payload for changing password on an existing authenticated account. */
export class ChangePasswordDto {
  /** Required when the account already has a password. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PASSWORD_LENGTH)
  currentPassword?: string;

  @IsNewPassword()
  newPassword: string;
}

