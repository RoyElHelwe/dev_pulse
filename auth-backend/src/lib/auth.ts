import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import { prisma } from "./prisma.js";
import { sendEmail } from "./email.js";

export const auth = betterAuth({
  appName: "Transcendence", // shown in authenticator apps (Google Authenticator)

  // OAuth providers redirect back to `${baseURL}/api/auth/callback/<provider>`
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
	enabled: true,
	requireEmailVerification: true,
  },

  emailVerification: {
	sendOnSignUp: true,                 // send the email right after register
	autoSignInAfterVerification: true,  // log in when the link is clicked
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
		`
	  );
	},
  },

  // OAuth providers
  // Emails from Google/GitHub are already verified, so these users skip the verify-email step.
  // If someone registered with email first and later uses Google with the same email,
  // Better Auth links both to the same account.
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

  //2FA with an authenticator app + backup codes
  plugins: [
	twoFactor({
	  issuer: "Transcendence",
	  // OAuth users have no password, so let them turn on 2FA without one.
	  allowPasswordless: true,
	}),
  ],

  trustedOrigins: ["http://localhost:3000"],
});
