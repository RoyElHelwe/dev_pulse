/**
 * Request client metadata extractor.
 * Collects IP address, user agent, and existing refresh token from incoming HTTP requests.
 */
import type { Request } from 'express';
import { COOKIES } from './cookies';
import type { ClientInfo } from './tokens.service';

/** Extracts client metadata (IP, user agent, current refresh token) from the HTTP request. */
export function clientInfo(req: Request): ClientInfo {
  return { userAgent: req.headers['user-agent'], ip: req.ip, refreshToken: req.cookies?.[COOKIES.refresh] };
}

