/**
 * Two-factor authentication data transfer objects.
 * Validates 2FA setup passwords, TOTP/backup codes, and trusted device preferences.
 */
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const MAX_PASSWORD_LENGTH = 128;
const MIN_2FA_CODE_LENGTH = 6;
const MAX_2FA_CODE_LENGTH = 20;

/** Request body payload to initiate two-factor authentication setup. */
export class TwoFactorSetupDto {
  /** Required when the account has a password (proves it's really you). */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password?: string;
}

/** Request body payload containing a 6-digit TOTP code or backup code. */
export class TwoFactorCodeDto {
  /** A 6-digit code from the app, or a backup code like "k7m2q-9xbte". */
  @IsString()
  @Length(MIN_2FA_CODE_LENGTH, MAX_2FA_CODE_LENGTH, { message: 'Enter the 6-digit code or a backup code.' })
  code: string;
}

/** Request body payload for completing 2FA login, optionally registering the browser as trusted. */
export class TwoFactorVerifyDto extends TwoFactorCodeDto {
  /** Skip the 2FA step on this browser for 30 days. */
  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}

