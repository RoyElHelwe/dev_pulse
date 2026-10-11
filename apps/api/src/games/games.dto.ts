/**
 * Data Transfer Objects (DTOs) and validation schemas for game REST endpoints.
 */

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { GameKind } from './game.types';

/** Default query interval in days for leaderboard rankings. */
export const DEFAULT_LEADERBOARD_DAYS = 7;

/** Minimum allowed leaderboard lookback window in days. */
export const MIN_LEADERBOARD_DAYS = 1;

/** Maximum allowed leaderboard lookback window in days. */
export const MAX_LEADERBOARD_DAYS = 90;

/**
 * Query parameter schema for GET /workspace/games/leaderboard.
 */
export class LeaderboardQueryDto {
  /** The minigame kind to retrieve leaderboard standings for. */
  @IsIn(['foosball', 'uno', 'lego'], {
    message: 'game must be one of: foosball, uno, lego',
  })
  game: GameKind;

  /** Number of days to include in the leaderboard window (1-90). */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'days must be an integer' })
  @Min(MIN_LEADERBOARD_DAYS, { message: 'days must be at least 1' })
  @Max(MAX_LEADERBOARD_DAYS, { message: 'days must be at most 90' })
  days: number = DEFAULT_LEADERBOARD_DAYS;
}
