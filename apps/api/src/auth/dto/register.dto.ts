/**
 * User registration request data transfer object.
 * Validates display name, email, and password for new account creation.
 */
import { IsDisplayName, IsEmailField, IsNewPassword } from './validation';

/** Request body payload for new account registration. */
export class RegisterDto {
  @IsDisplayName()
  displayName: string;

  @IsEmailField()
  email: string;

  @IsNewPassword()
  password: string;
}

