/**
 * Remote session closure request data transfer object.
 * Validates session closure action tokens and cross-browser confirmation passwords.
 */
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

const MIN_CLOSE_TOKEN_LENGTH = 20;
const MAX_CLOSE_TOKEN_LENGTH = 200;
const MAX_PASSWORD_LENGTH = 128;

/** Request body payload for closing all active sessions via email confirmation. */
export class CloseSessionsDto {
  @IsString()
  @Length(MIN_CLOSE_TOKEN_LENGTH, MAX_CLOSE_TOKEN_LENGTH)
  token: string;

  /** Only needed when the link is opened in another browser than the one that asked for it. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password?: string;
}

