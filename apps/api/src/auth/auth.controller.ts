import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Public } from '../common/auth/public.decorator';
import { AppConfig } from '../config/app-config';
import { AuthService, type SignInResult } from './auth.service';
import { clientInfo } from './client-info';
import { clearSessionCookies, COOKIES, setSessionCookies } from './cookies';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokensService } from './tokens.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(await this.auth.register(dto, clientInfo(req)), res);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(await this.auth.login(dto, clientInfo(req)), res);
  }

  /** The signed-in user. */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  /** Devices where this account is signed in. */
  @Get('sessions')
  async sessions(@CurrentUser() user: AuthUser) {
    const sessions = await this.tokens.listSessions(user.id);
    return sessions.map((s) => ({ ...s, current: s.id === user.sessionId }));
  }

  /** Signs out one device. */
  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.tokens.revokeSession(user.id, id);
  }

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

  /** Sets the cookies when a session was created; the body never contains tokens. */
  private respond(result: SignInResult, res: Response) {
    if (result.status === 'signed-in') setSessionCookies(res, result.tokens, this.config);
    return { status: result.status, user: result.user };
  }
}
