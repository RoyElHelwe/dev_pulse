import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/auth/public.decorator';
import { AppConfig } from '../../config/app-config';
import { clientInfo } from '../client-info';
import { COOKIE_OPTIONS, COOKIES, setSessionCookies } from '../cookies';
import { safeRedirect } from '../crypto/redirect';
import { isProvider } from './providers';
import { OAuthError, OAuthService } from './oauth.service';

/** Browser redirects (not JSON): the user follows these links. */
@Public()
@Controller('auth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly config: AppConfig,
  ) {}

  @Get('providers')
  providers() {
    return this.oauth.available();
  }

  @Get('oauth/:provider')
  start(@Param('provider') provider: string, @Query('redirect') redirect: string | undefined, @Res() res: Response) {
    try {
      if (!isProvider(provider)) throw new OAuthError('oauth_unavailable');
      const { url, cookie, maxAgeMs } = this.oauth.start(provider, safeRedirect(redirect));
      res.cookie(COOKIES.oauth, cookie, { ...COOKIE_OPTIONS.oauth, maxAge: maxAgeMs });
      res.redirect(302, url);
    } catch (error) {
      this.fail(res, error);
    }
  }

  @Get('oauth/:provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query() query: { code?: string; state?: string; error?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.clearCookie(COOKIES.oauth, COOKIE_OPTIONS.oauth);
    try {
      if (!isProvider(provider)) throw new OAuthError('oauth_unavailable');
      const { result, redirect } = await this.oauth.finish(
        provider,
        query,
        req.cookies?.[COOKIES.oauth],
        clientInfo(req),
        req.cookies?.[COOKIES.trustedDevice],
      );
      if (result.status === 'two-factor-required') {
        res.cookie(COOKIES.mfa, result.mfaToken, { ...COOKIE_OPTIONS.mfa, maxAge: 5 * 60 * 1000 });
        return res.redirect(302, `/two-factor?redirect=${encodeURIComponent(redirect)}`);
      }
      if (result.status !== 'signed-in') throw new OAuthError('oauth_failed');
      setSessionCookies(res, result.tokens, this.config);
      res.redirect(302, redirect);
    } catch (error) {
      this.fail(res, error);
    }
  }

  private fail(res: Response, error: unknown) {
    const code = error instanceof OAuthError ? error.code : 'oauth_failed';
    res.redirect(302, `/login?error=${code}`);
  }
}
