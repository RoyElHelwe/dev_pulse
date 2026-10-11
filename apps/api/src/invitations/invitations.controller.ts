/**
 * HTTP controller managing workspace invitations from both admin and recipient perspectives.
 * Covers invitation issuance, resending, revoking, token inspection, and acceptance.
 */

import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Public } from '../common/auth/public.decorator';
import { AcceptInvitationDto } from '../workspace/workspace.dto';
import { InviteDto } from './invitations.dto';
import { InvitationsService } from './invitations.service';

const RATE_LIMIT_TTL_MS = 60_000;
const CREATE_INVITATION_LIMIT = 20;
const MUTATION_INVITATION_LIMIT = 10;
const PEEK_INVITATION_LIMIT = 30;

/** REST controller exposing workspace invitation administration and onboarding actions. */
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  // ---- organiser side ------------------------------------------------------

  @Throttle({ default: { limit: CREATE_INVITATION_LIMIT, ttl: RATE_LIMIT_TTL_MS } })
  @Post('workspace/invitations')
  create(@CurrentUser() user: AuthUser, @Body() dto: InviteDto) {
    return this.invitations.create(user.id, dto.email, dto.role);
  }

  @Get('workspace/invitations')
  list(@CurrentUser() user: AuthUser) {
    return this.invitations.list(user.id);
  }

  @Throttle({ default: { limit: MUTATION_INVITATION_LIMIT, ttl: RATE_LIMIT_TTL_MS } })
  @Post('workspace/invitations/:id/resend')
  resend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invitations.resend(user.id, id);
  }

  @Delete('workspace/invitations/:id')
  @HttpCode(204)
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invitations.revoke(user.id, id);
  }

  // ---- invited person's side -------------------------------------------------

  @Public()
  @Throttle({ default: { limit: PEEK_INVITATION_LIMIT, ttl: RATE_LIMIT_TTL_MS } })
  @Get('invitations/:token')
  peek(@Param('token') token: string) {
    return this.invitations.peek(token);
  }

  @Throttle({ default: { limit: MUTATION_INVITATION_LIMIT, ttl: RATE_LIMIT_TTL_MS } })
  @Post('invitations/:token/accept')
  @HttpCode(204)
  accept(@CurrentUser() user: AuthUser, @Param('token') token: string, @Body() dto: AcceptInvitationDto) {
    return this.invitations.accept(user.id, token, dto.character);
  }

  @Public()
  @Throttle({ default: { limit: MUTATION_INVITATION_LIMIT, ttl: RATE_LIMIT_TTL_MS } })
  @Post('invitations/:token/decline')
  @HttpCode(204)
  decline(@Param('token') token: string) {
    return this.invitations.decline(token);
  }
}

