import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsEmailField } from './validation';

export class LoginDto {
  @IsEmailField()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Enter your password.' })
  @MaxLength(128)
  password: string;
}
