import { betterAuth } from 'better-auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL!,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  advanced: {
    cookiePrefix: 'ft_trans',
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
  // Social providers (can be enabled later)
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      enabled: !!process.env.GITHUB_CLIENT_ID,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
  },
  // Two-factor authentication
  twoFactor: {
    enabled: true,
    issuer: 'ft_transcendence',
  },
});

export type Auth = typeof auth;
