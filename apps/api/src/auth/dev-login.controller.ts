import { Body, Controller, Get, HttpCode, NotFoundException, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/auth/public.decorator';
import { AppConfig } from '../config/app-config';
import { clientInfo } from './client-info';
import { setSessionCookies } from './cookies';
import { DevLoginService } from './dev-login.service';
import { DevLoginDto, DevUserDto } from './dto/dev-login.dto';
import type { SignInResult } from './auth.service';

/** Dev identity switcher. Every route refuses (404) unless DEV_LOGIN=true. */
@Controller('auth/dev')
export class DevLoginController {
  constructor(
    private readonly dev: DevLoginService,
    private readonly config: AppConfig,
  ) {}

  /** `{ enabled: false }` when off, so the login page knows to show the normal forms. */
  @Public()
  @Get()
  async status() {
    if (!this.dev.enabled) return { enabled: false, users: [] };
    return { enabled: true, users: await this.dev.list() };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: DevLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!this.dev.enabled) throw new NotFoundException();
    return this.respond(await this.dev.login(dto.userId, clientInfo(req)), res);
  }

  @Public()
  @Post('users')
  @HttpCode(200)
  async createUser(@Body() dto: DevUserDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!this.dev.enabled) throw new NotFoundException();
    return this.respond(await this.dev.createUser(dto.name, dto.joinUserId, clientInfo(req)), res);
  }

  private respond(result: SignInResult, res: Response) {
    if (result.status === 'signed-in') {
      setSessionCookies(res, result.tokens, this.config);
      return { status: result.status, user: result.user };
    }
    if (result.status === 'session-active') return { status: result.status, device: result.device };
    return { status: result.status };
  }
}
