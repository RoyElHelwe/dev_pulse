import type { Request } from 'express';
import type { ClientInfo } from './tokens.service';

/** Browser + IP, shown in the "signed-in devices" list. */
export function clientInfo(req: Request): ClientInfo {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}
