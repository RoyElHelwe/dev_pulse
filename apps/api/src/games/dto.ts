import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { GameKind } from './game.types';

export class LeaderboardQueryDto {
  @IsIn(['foosball', 'uno', 'lego'], {
    message: 'game must be one of: foosball, uno, lego',
  })
  game: GameKind;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'days must be an integer' })
  @Min(1, { message: 'days must be at least 1' })
  @Max(90, { message: 'days must be at most 90' })
  days: number = 7;
}
