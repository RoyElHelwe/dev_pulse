/** Request bodies of the kitchen café, validated by the global ValidationPipe. */

import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_GRANT, MENU } from './kitchen.rules';

/** POST /kitchen/buy */
export class BuyDto {
  @IsIn(MENU.map((m) => m.key))
  item: string;
}

/** POST /kitchen/grants (owners and admins) */
export class GrantDto {
  @IsString()
  @MaxLength(64)
  userId: string;

  @IsInt()
  @Min(1)
  @Max(MAX_GRANT)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  note?: string;
}
