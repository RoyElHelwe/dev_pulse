import { createAuthClient } from "better-auth/react";
import {
  twoFactorClient,
  jwtClient,
  organizationClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  plugins: [
	twoFactorClient(),
	jwtClient(),          // authClient.token(),access JWT (15 min)
	organizationClient(), // authClient.organization  workspaces, members, invites
  ],
});
