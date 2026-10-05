import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class TwoFactorSetupDto {
  /** Required when the account has a password (proves it's really you). */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;
}

export class TwoFactorCodeDto {
  /** A 6-digit code from the app, or a backup code like "k7m2q-9xbte". */
  @IsString()
  @Length(6, 20, { message: 'Enter the 6-digit code or a backup code.' })
  code: string;
}

export class TwoFactorVerifyDto extends TwoFactorCodeDto {
  /** Skip the 2FA step on this browser for 30 days. */
  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}
