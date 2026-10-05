import type { Socket } from 'socket.io';
import type { TokensService } from '../../auth/tokens.service';
import type { AuthUser } from './auth-user';

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(';') ?? []) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

/**
 * Who is behind a Socket.IO connection. The browser sends the same
 * access_token cookie on the handshake (same site, through nginx).
 *
 * In a gateway:
 *   handleConnection(socket: Socket) {
 *     const user = authenticateSocket(socket, this.tokens);
 *     if (!user) return socket.disconnect(true);
 *   }
 * Later events read socket.data.user.
 */
export function authenticateSocket(socket: Socket, tokens: TokensService): AuthUser | null {
  const fromAuth = (socket.handshake.auth as { token?: string } | undefined)?.token;
  const token = fromAuth ?? readCookie(socket.handshake.headers.cookie, 'access_token');
  const user = token ? tokens.verifyAccessToken(token) : null;
  socket.data.user = user;
  return user;
}
