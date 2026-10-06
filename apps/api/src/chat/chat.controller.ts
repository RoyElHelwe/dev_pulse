import { Controller, Get, Query } from '@nestjs/common';
import { IsISO8601, IsOptional, Matches } from 'class-validator';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { FormError } from '../common/form-error';
import { ZONE_ID } from '../office/rules';
import { MembershipService } from '../workspace/membership.service';
import { ChatService } from './chat.service';

class HistoryQuery {
  @Matches(ZONE_ID)
  channel: string;

  /** `createdAt` of the oldest message already shown (to load older ones). */
  @IsOptional()
  @IsISO8601()
  before?: string;

  /** And its id: messages of the same millisecond aren't skipped. */
  @IsOptional()
  @Matches(/^\w{1,64}$/)
  beforeId?: string;
}

@Controller('workspace/chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly membership: MembershipService,
  ) {}

  /** `?channel=office|<room id>&before=<ISO date>&beforeId=<message id>` → the last 50 messages, oldest first. */
  @Get()
  async history(@CurrentUser() user: AuthUser, @Query() query: HistoryQuery) {
    const member = await this.membership.require(user.id);
    const result = await this.chat.history(member.workspaceId, user.id, query.channel, query.before ? new Date(query.before) : undefined, query.beforeId);
    if ('error' in result && result.error) throw new FormError(result.error.code, result.error.message);
    return result;
  }
}
