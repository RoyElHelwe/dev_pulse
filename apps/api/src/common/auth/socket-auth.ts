/**
 * WebSocket handshake authentication helper.
 * Extracts and verifies JWT access tokens from Socket.IO handshake auth objects or cookies.
 */
import type { Socket } from 'socket.io';
import { COOKIES } from '../../auth/cookies';
import type { TokensService } from '../../auth/tokens.service';
import type { AuthUser } from './auth-user';

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

/** Authenticates a Socket.IO connection from handshake credentials or cookies, populating socket.data.user. */
export function authenticateSocket(socket: Socket, tokens: TokensService): AuthUser | null {
  const fromAuth = (socket.handshake.auth as { token?: string } | undefined)?.token;
  const token = fromAuth ?? readCookie(socket.handshake.headers.cookie, COOKIES.access);
  const user = token ? tokens.verifyAccessToken(token) : null;
  socket.data.user = user;
  return user;
}

