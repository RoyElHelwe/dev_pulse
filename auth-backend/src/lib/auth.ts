import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor, organization, genericOAuth } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "./prisma.js";
import { sendEmail } from "./email.js";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const TWO_FACTOR_COOKIE_MAX_AGE = 60 * 10; // the user has 10 minutes to type the code

export const auth = betterAuth({
  appName: "Transcendence", // shown in authenticator apps (Google Authenticator)

  // OAuth providers redirect back to `${baseURL}/api/auth/callback/<provider>`
  // (google, github, fortytwo)
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
	enabled: true,
	requireEmailVerification: true,
  },

  //one session cookie does everything (no JWTno refresh token)
  //the session is a row in the db so we can delete it to sign a device out at once
  session: {
	expiresIn: 60 * 15, // 15 min: signed out after 15 minutes of doing nothing
	updateAge: 60, // while the user is active, push the expiry forward (at most once a minute)
  },

  emailVerification: {
	sendOnSignUp: true, // send the email right after register
	autoSignInAfterVerification: true, // log in when the link is clicked
	sendVerificationEmail: async ({ user, url }) => {
	  void sendEmail(
		user.email,
		"Verify your email",
		`
		  <h2>Welcome to Transcendence, ${user.name}!</h2>
		  <p>Click the button to verify your email:</p>
		  <a href="${url}" style="background:#4f46e5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">
			Verify my email
		  </a>
		  <p>If you didn't create an account, ignore this email.</p>
		`,
	  );
	},
  },

  // If someone registered with email first and later uses Google/GitHub/42 with the same email,
  // Better Auth links both to the same user.
  account: {
	accountLinking: {
	  enabled: true,
	  trustedProviders: ["google", "github", "fortytwo"],
	},
  },

  // OAuth providers
  // Emails from Google/GitHub/42 are already verified, so these users skip the verify-email step.
  socialProviders: {
	google: {
	  clientId: process.env.GOOGLE_CLIENT_ID as string,
	  clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
	  prompt: "select_account", // always let the user pick which Google account
	},
	github: {
	  clientId: process.env.GITHUB_CLIENT_ID as string,
	  clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
	},
  },

  plugins: [
	// 2FA with an authenticator app + backup codes
	twoFactor({
	  issuer: "Transcendence",
	  // OAuth users have no password, so let them turn on 2FA without one.
	  allowPasswordless: true,
	}),

	// Workspaces, members, roles (owner / admin / member) and invitations.
	// Renamed so the tables match our plan: workspace, workspaceMember, workspaceId.
	organization({
	  schema: {
		organization: {
		  modelName: "workspace",
		},
		member: {
		  modelName: "workspaceMember",
		  fields: { organizationId: "workspaceId" },
		  additionalFields: {
			character: { type: "string", required: false, defaultValue: "default" },
		  },
		},
		invitation: {
		  fields: { organizationId: "workspaceId" },
		},
	  },
	}),

	// Login with 42 intra.
	// 42 is not a built-in provider (and not OpenID Connect), so we use the generic OAuth
	// plugin and read the user's profile from /v2/me ourselves.
	genericOAuth({
	  config: [
		{
		  providerId: "fortytwo",
		  clientId: process.env.FT_CLIENT_ID as string,
		  clientSecret: process.env.FT_CLIENT_SECRET as string,
		  authorizationUrl: "https://api.intra.42.fr/oauth/authorize",
		  tokenUrl: "https://api.intra.42.fr/oauth/token",
		  scopes: ["public"],
		  getUserInfo: async (tokens) => {
			const res = await fetch("https://api.intra.42.fr/v2/me", {
			  headers: { Authorization: `Bearer ${tokens.accessToken}` },
			});
			if (!res.ok) return null;
			const me = await res.json();
			return {
			  id: String(me.id),
			  email: me.email,
			  name: me.usual_full_name || me.displayname || me.login,
			  image: me.image?.link ?? null,
			  emailVerified: true, // 42 emails come from the school
			};
		  },
		},
	  ],
	}),
  ],

  // Better Auth only asks for the 2FA code after email + password login.
  // This hook does the same after Google / GitHub / 42 logins:
  // if the user has 2FA on, we cancel the session that was just created
  // and send them to /two-factor to type the code first.
  hooks: {
	after: createAuthMiddleware(async (ctx) => {
	  if (!ctx.path.startsWith("/callback")) return; // only OAuth logins

	  const data = ctx.context.newSession;
	  if (!data) return; // login failed, or it was only linking an account
	  const user = data.user as typeof data.user & { twoFactorEnabled?: boolean | null };
	  if (!user.twoFactorEnabled) return; // 2FA not set up yet -> dashboard sends them to setup

	  // "Don't ask again on this device for 30 days" -> skip the code
	  const trustCookie = ctx.context.createAuthCookie("trust_device");
	  const trustValue = await ctx.getSignedCookie(trustCookie.name, ctx.context.secret);
	  if (trustValue) {
		const [token, trustId] = trustValue.split("!");
		const expected = createHmac("sha256", ctx.context.secret)
		  .update(`${user.id}!${trustId}`)
		  .digest("base64url");
		if (token && trustId && token === expected) {
		  const record = await ctx.context.internalAdapter.findVerificationValue(trustId);
		  if (record && record.value === user.id && record.expiresAt > new Date()) return;
		}
	  }

	  // cancel the session: the user is NOT logged in until the code is correct
	  deleteSessionCookie(ctx, true);
	  await ctx.context.internalAdapter.deleteSession(data.session.token);
	  ctx.context.setNewSession(null);

	  // same "2FA pending" cookie the email + password login uses,
	  // so the /two-factor page and verifyTotp work exactly the same
	  const twoFactorCookie = ctx.context.createAuthCookie("two_factor", {
		maxAge: TWO_FACTOR_COOKIE_MAX_AGE,
	  });
	  const identifier = `2fa-${randomBytes(15).toString("hex")}`;
	  const expiresAt = new Date(Date.now() + TWO_FACTOR_COOKIE_MAX_AGE * 1000);
	  await ctx.context.internalAdapter.createVerificationValue({
		value: user.id,
		identifier,
		expiresAt,
	  });
	  await ctx.context.internalAdapter.createVerificationValue({
		value: "0",
		identifier: `2fa-attempts-${identifier}`,
		expiresAt,
	  });
	  await ctx.setSignedCookie(
		twoFactorCookie.name,
		identifier,
		ctx.context.secret,
		twoFactorCookie.attributes,
	  );

	  throw ctx.redirect(`${FRONTEND_URL}/two-factor`);
	}),
  },

  trustedOrigins: ["http://localhost:3000"],
});