import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthUser } from '../common/auth/auth-user';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { Public } from '../common/auth/public.decorator';
import { AppConfig } from '../config/app-config';
import { AuthService, type SignInResult } from './auth.service';
import { clientInfo } from './client-info';
import { clearSessionCookies, COOKIE_OPTIONS, COOKIES, setSessionCookies } from './cookies';
import { EmailDto, TokenDto } from './dto/email.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto, ResetPasswordDto } from './dto/password.dto';
import { TwoFactorCodeDto, TwoFactorSetupDto, TwoFactorVerifyDto } from './dto/two-factor.dto';
import { RegisterDto } from './dto/register.dto';
import { PasswordService } from './password.service';
import { TokensService } from './tokens.service';
import { TwoFactorService } from './two-factor.service';
import { VerificationService } from './verification.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
    private readonly verification: VerificationService,
    private readonly passwords: PasswordService,
    private readonly twoFactor: TwoFactorService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(await this.auth.register(dto, clientInfo(req)), res);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto, clientInfo(req), req.cookies?.[COOKIES.trustedDevice]);
    return this.respond(result, res);
  }

  // ---- two-factor authentication -------------------------------------------

  /** After the password step: check the code and finish signing in. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/verify')
  @HttpCode(200)
  async verifyTwoFactor(@Body() dto: TwoFactorVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.completeTwoFactor(req.cookies?.[COOKIES.mfa], dto.code, clientInfo(req));
    res.clearCookie(COOKIES.mfa, COOKIE_OPTIONS.mfa);
    if (dto.trustDevice && result.status === 'signed-in') {
      res.cookie(COOKIES.trustedDevice, await this.twoFactor.trustedDeviceToken(result.user.id), {
        ...COOKIE_OPTIONS.trustedDevice,
        maxAge: TwoFactorService.trustMaxAgeMs,
      });
    }
    return this.respond(result, res);
  }

  @Post('2fa/setup')
  @HttpCode(200)
  setupTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorSetupDto) {
    return this.twoFactor.setup(user.id, dto.password);
  }

  @Post('2fa/enable')
  @HttpCode(200)
  enableTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto) {
    return this.twoFactor.enable(user.id, user.sessionId, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(204)
  async disableTwoFactor(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto, @Res({ passthrough: true }) res: Response) {
    await this.twoFactor.disable(user.id, dto.code);
    res.clearCookie(COOKIES.trustedDevice, COOKIE_OPTIONS.trustedDevice);
  }

  @Post('2fa/backup-codes')
  @HttpCode(200)
  regenerateBackupCodes(@CurrentUser() user: AuthUser, @Body() dto: TwoFactorCodeDto) {
    return this.twoFactor.regenerateBackupCodes(user.id, dto.code);
  }

  /** The link from the "confirm your email" message. */
  @Public()
  @Post('email/verify')
  @HttpCode(204)
  verifyEmail(@Body() dto: TokenDto) {
    return this.verification.verify(dto.token);
  }

  /** Sends a new confirmation link (same answer whether the account exists or not). */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('email/resend')
  @HttpCode(204)
  resendVerification(@Body() dto: EmailDto) {
    return this.verification.resend(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/forgot')
  @HttpCode(204)
  forgotPassword(@Body() dto: EmailDto) {
    return this.passwords.forgot(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('password/reset')
  @HttpCode(204)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwords.reset(dto);
  }

  @Post('password/change')
  @HttpCode(204)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.passwords.change(user.id, user.sessionId, dto);
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
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
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

  /** Sets the cookies for the result; the body never contains tokens. */
  private respond(result: SignInResult, res: Response) {
    if (result.status === 'two-factor-required') {
      res.cookie(COOKIES.mfa, result.mfaToken, { ...COOKIE_OPTIONS.mfa, maxAge: 5 * 60 * 1000 });
      return { status: result.status };
    }
    if (result.status === 'signed-in') setSessionCookies(res, result.tokens, this.config);
    return { status: result.status, user: result.user };
  }
}
