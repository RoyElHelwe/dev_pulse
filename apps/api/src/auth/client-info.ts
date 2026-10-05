import type { Request } from 'express';
import { COOKIES } from './cookies';
import type { ClientInfo } from './tokens.service';

/** Browser + IP (shown in the devices list) and the browser's current refresh token. */
export function clientInfo(req: Request): ClientInfo {
  return { userAgent: req.headers['user-agent'], ip: req.ip, refreshToken: req.cookies?.[COOKIES.refresh] };
}
