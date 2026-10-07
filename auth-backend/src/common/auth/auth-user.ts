import type { auth } from "../../lib/auth.js";

// The types Better Auth returns from getSession(), so the whole team gets autocomplete.
type SessionResult = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

/*The signed-in user: id, email, name, image, emailVerified... */
export type AuthUser = SessionResult["user"];

/*The session row: id,expiresAt,activeOrganizationId (current workspace) and so on*/
export type AuthSession = SessionResult["session"];
