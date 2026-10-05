import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IsNewPassword } from './validation';

export class ResetPasswordDto {
  @IsString()
  @Length(20, 200)
  token: string;

  @IsNewPassword()
  password: string;
}

export class ChangePasswordDto {
  /** Required when the account already has a password. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword?: string;

  @IsNewPassword()
  newPassword: string;
}
