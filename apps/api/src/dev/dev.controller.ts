/**
 * Dev/test HTTP controller for identity switching.
 * Exposes endpoints to list users, switch identity, and generate test users without passwords or 2FA outside production.
 */
import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { SignInResult } from '../auth/auth.service';
import { clientInfo } from '../auth/client-info';
import { setSessionCookies } from '../auth/cookies';
import { Public } from '../common/auth/public.decorator';
import { AppConfig } from '../config/app-config';
import { DevLoginDto, DevUserDto } from './dev.dto';
import { DevService } from './dev.service';

/** Dev identity switcher controller for rapid testing and persona switching. */
@Controller('auth/dev')
export class DevController {

  constructor(
    private readonly dev: DevService,
    private readonly config: AppConfig,
  ) {}

  /** The users the switcher offers. (Whether the switcher is on at all: GET /auth/dev in AuthController.) */
  @Public()
  @Get('users')
  async users() {
    return { users: await this.dev.list() };
  }

  /** Signs in as the given user, skipping password and 2FA. */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: DevLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(await this.dev.login(dto.userId, clientInfo(req)), res);
  }

  /** Creates a verified throwaway user (optionally in someone's office) and signs in as them. */
  @Public()
  @Post('users')
  @HttpCode(200)
  async createUser(@Body() dto: DevUserDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(await this.dev.createUser(dto.name, dto.joinUserId, clientInfo(req)), res);
  }

  /** Same response shape as the normal sign-in routes: cookies for the session, JSON for the rest. */
  private respond(result: SignInResult, res: Response) {
    if (result.status === 'signed-in') {
      setSessionCookies(res, result.tokens, this.config);
      return { status: result.status, user: result.user };
    }
    if (result.status === 'session-active') return { status: result.status, device: result.device };
    return { status: result.status };
  }
}
