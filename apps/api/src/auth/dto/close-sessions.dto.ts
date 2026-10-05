import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CloseSessionsDto {
  @IsString()
  @Length(20, 200)
  token: string;

  /** Only needed when the link is opened in another browser than the one that asked for it. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;
}
