import { IsDisplayName, IsEmailField, IsNewPassword } from './validation';

export class RegisterDto {
  @IsDisplayName()
  displayName: string;

  @IsEmailField()
  email: string;

  @IsNewPassword()
  password: string;
}
