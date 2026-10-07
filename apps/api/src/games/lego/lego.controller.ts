import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { MembershipService } from '../../workspace/membership.service';
import { LegoService } from './lego.service';

@Controller('workspace/lego')
export class LegoController {
  constructor(
    private readonly legoService: LegoService,
    private readonly membership: MembershipService,
  ) {}

  @Get()
  async getBoards(@CurrentUser() user: AuthUser) {
    const member = await this.membership.require(user.id);
    const boards = await this.legoService.listBoards(member.workspaceId);
    return { boards };
  }
}
