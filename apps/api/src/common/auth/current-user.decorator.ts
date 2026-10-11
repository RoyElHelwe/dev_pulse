/**
 * Current user parameter decorator.
 * Extracts the authenticated AuthUser instance attached to the HTTP request by AuthGuard.
 */
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from './auth-user';

/** Parameter decorator injecting the verified AuthUser payload from the current request. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
  return request.user;
});

