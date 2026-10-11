/**
 * Email and token submission data transfer objects.
 * Validates email addresses and verification/reset token strings.
 */
import { IsString, Length } from 'class-validator';
import { IsEmailField } from './validation';

const MIN_AUTH_TOKEN_LENGTH = 20;
const MAX_AUTH_TOKEN_LENGTH = 200;

/** Request body payload containing an email address for verification or password recovery. */
export class EmailDto {
  @IsEmailField()
  email: string;
}

/** Request body payload containing a single one-time email action token. */
export class TokenDto {
  @IsString()
  @Length(MIN_AUTH_TOKEN_LENGTH, MAX_AUTH_TOKEN_LENGTH)
  token: string;
}

