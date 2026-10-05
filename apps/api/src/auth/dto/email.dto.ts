import { IsString, Length } from 'class-validator';
import { IsEmailField } from './validation';

export class EmailDto {
  @IsEmailField()
  email: string;
}

export class TokenDto {
  @IsString()
  @Length(20, 200)
  token: string;
}
