import type { auth } from "../../lib/auth.js";

// The types Better Auth returns from getSession(), so the whole team gets autocomplete.
type SessionResult = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

/*The signed-in user: id, email, name, image, emailVerified... */
export type AuthUser = SessionResult["user"];

/*The session row: id,expiresAt,activeOrganizationId (current workspace) and so on*/
export type AuthSession = SessionResult["session"];

//This file gives a name to the information that Better Auth gives us
//when we do auth.api.getSession() it gave us like user{id:...,name:"" ,email""}
//session{id...,expireat...}
//so there is 2 info authuser mean the user info and authsession info about session
//we need this bcz @CurrentUser()->@CurrentUser() user: AuthUser
//better-ayth->getsession->info on session &user