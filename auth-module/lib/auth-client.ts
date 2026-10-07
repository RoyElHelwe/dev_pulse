import { createAuthClient } from "better-auth/react";
import { twoFactorClient, organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  plugins: [
	twoFactorClient(),
	organizationClient(), // authClient.organization: workspaces, members, invites
  ],
});