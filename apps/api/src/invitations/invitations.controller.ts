import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn } from 'class-validator';
import { IsEmailField } from '../auth/dto/validation';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Public } from '../common/auth/public.decorator';
import { InvitationsService } from './invitations.service';

class InviteDto {
  @IsEmailField()
  email: string;

  @IsIn(['ADMIN', 'MEMBER'])
  role: 'ADMIN' | 'MEMBER';
}

@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  // ---- organiser side ------------------------------------------------------

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('workspace/invitations')
  create(@CurrentUser() user: AuthUser, @Body() dto: InviteDto) {
    return this.invitations.create(user.id, dto.email, dto.role);
  }

  @Get('workspace/invitations')
  list(@CurrentUser() user: AuthUser) {
    return this.invitations.list(user.id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('invitations/:token')
  peek(@Param('token') token: string) {
    return this.invitations.peek(token);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('invitations/:token/accept')
  @HttpCode(204)
  accept(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.invitations.accept(user.id, token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('invitations/:token/decline')
  @HttpCode(204)
  decline(@Param('token') token: string) {
    return this.invitations.decline(token);
  }
}
