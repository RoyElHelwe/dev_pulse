/**
 * REST controller exposing game-related endpoints for the virtual office.
 * Provides leaderboard summaries aggregated across workspaces.
 */

import { Controller, Get, Query } from '@nestjs/common';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { MembershipService } from '../workspace/membership.service';
import { LeaderboardQueryDto } from './games.dto';
import { GameResultsService } from './game-results.service';

/**
 * Controller serving minigame leaderboards and statistics for authenticated workspace members.
 */
@Controller('workspace/games')
export class GamesController {
  constructor(
    private readonly gameResults: GameResultsService,
    private readonly membership: MembershipService,
  ) {}

  /**
   * Retrieves aggregated leaderboard rankings for a specific game within the caller's workspace.
   */
  @Get('leaderboard')
  async leaderboard(@CurrentUser() user: AuthUser, @Query() query: LeaderboardQueryDto) {
    const member = await this.membership.require(user.id);
    return this.gameResults.leaderboard(member.workspaceId, query.game, query.days);
  }
}
