/**
 * Global authentication guard.
 * Validates JWT access tokens from Authorization headers or httpOnly cookies, ensuring the session is still active.
 */
import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { COOKIES } from '../../auth/cookies';
import { TokensService } from '../../auth/tokens.service';
import { IS_PUBLIC } from './public.decorator';

const BEARER_PREFIX = 'Bearer ';

/**
 * Global guard: reads the access token from the httpOnly cookie (browser) or
 * the Authorization header (scripts, API clients), checks its signature, then
 * checks that its device session was not signed out in the meantime.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true; // sockets use authenticateSocket()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const token = header?.startsWith(BEARER_PREFIX)
      ? header.slice(BEARER_PREFIX.length)
      : request.cookies?.[COOKIES.access];
    if (!token) throw new UnauthorizedException({ code: 'NOT_AUTHENTICATED', message: 'Please sign in.' });

    const user = this.tokens.verifyAccessToken(token);
    if (!user) throw new UnauthorizedException({ code: 'TOKEN_EXPIRED', message: 'Your session has expired.' });
    // Check revocation in database: ensures immediate sign-out across all tabs when a session is closed.
    if (!(await this.tokens.isSessionAlive(user.sessionId))) {
      throw new UnauthorizedException({ code: 'SESSION_ENDED', message: 'You were signed out.' });
    }
    (request as Request & { user: unknown }).user = user;
    return true;
  }
}

