import { Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Public } from '../common/auth/public.decorator';
import { AppConfig } from '../config/app-config';
import { clientInfo } from './client-info';
import { clearSessionCookies, COOKIES, setSessionCookies } from './cookies';
import { TokensService } from './tokens.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly tokens: TokensService,
    private readonly config: AppConfig,
  ) {}

  /** New access token + new refresh token (the old one stops working). */
  @Public()
  @Post('refresh')
  @HttpCode(204)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const tokens = await this.tokens.rotate(req.cookies?.[COOKIES.refresh], clientInfo(req));
      setSessionCookies(res, tokens, this.config);
    } catch (error) {
      clearSessionCookies(res);
      throw error;
    }
  }

  /** Signs out this device. */
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.tokens.revokeSession(user.id, user.sessionId);
    clearSessionCookies(res);
  }

  /** Signs out every device, including this one. */
  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.tokens.revokeAllSessions(user.id);
    clearSessionCookies(res);
  }
}
