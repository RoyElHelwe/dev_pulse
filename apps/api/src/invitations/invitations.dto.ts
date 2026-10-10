import { IsIn } from 'class-validator';
import { IsEmailField } from '../auth/dto/validation';

export class InviteDto {
  @IsEmailField()
  email: string;

  @IsIn(['ADMIN', 'MEMBER'])
  role: 'ADMIN' | 'MEMBER';
}
