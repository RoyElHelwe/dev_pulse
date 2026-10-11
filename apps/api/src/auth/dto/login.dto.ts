/**
 * User login request data transfer object.
 * Validates credentials for initial password-based authentication.
 */
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsEmailField } from './validation';

const MAX_PASSWORD_LENGTH = 128;

/** Request body payload for password-based user sign-in. */
export class LoginDto {
  @IsEmailField()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Enter your password.' })
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string;
}

