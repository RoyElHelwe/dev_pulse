import { ForbiddenException, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppConfig } from '../config/app-config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Blocks requests that change data when they come from another website
 * (cross-site request forgery). Browsers always send Origin on such requests;
 * scripts and API clients without an Origin header are not affected.
 */
@Injectable()
export class OriginMiddleware implements NestMiddleware {
  private readonly allowed: string;

  constructor(config: AppConfig) {
    this.allowed = new URL(config.appUrl).origin;
  }

  use(req: Request, _res: Response, next: NextFunction) {
    const origin = req.headers.origin;
    if (!SAFE_METHODS.has(req.method) && origin && origin !== this.allowed) {
      throw new ForbiddenException({ code: 'BAD_ORIGIN', message: 'Request blocked: unknown origin.' });
    }
    next();
  }
}
