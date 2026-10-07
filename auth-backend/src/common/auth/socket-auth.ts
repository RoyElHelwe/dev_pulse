import { fromNodeHeaders } from "better-auth/node";
import type { IncomingHttpHeaders } from "node:http";
import { auth } from "../../lib/auth.js";
import type { AuthSession, AuthUser } from "./auth-user.js";

interface SocketLike {
  handshake: { headers: IncomingHttpHeaders };
  data: { user?: AuthUser; session?: AuthSession; [key: string]: unknown };
}

export async function authenticateSocket(socket: SocketLike): Promise<AuthUser | null> {
  const result = await auth.api.getSession({
	headers: fromNodeHeaders(socket.handshake.headers),
  });

  if (!result) return null;

  socket.data.user = result.user;
  socket.data.session = result.session;
  return result.user;
}
