import { Controller, Get, Query } from '@nestjs/common';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { MembershipService } from '../workspace/membership.service';
import { LeaderboardQueryDto } from './dto';
import { GameResultsService } from './game-results.service';

@Controller('workspace/games')
export class GamesController {
  constructor(
    private readonly gameResults: GameResultsService,
    private readonly membership: MembershipService,
  ) {}

  @Get('leaderboard')
  async leaderboard(@CurrentUser() user: AuthUser, @Query() query: LeaderboardQueryDto) {
    const member = await this.membership.require(user.id);
    return this.gameResults.leaderboard(member.workspaceId, query.game, query.days);
  }
}
