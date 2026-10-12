// Validation schemas and error extractors for authentication form inputs.

import { z } from 'zod';

// Same rules as the API DTOs (apps/api/src/auth/dto/validation.ts).

const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 50;

/** Normalises email strings to lowercase, trims whitespace, and validates formatting up to 254 characters. */
export const emailField = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(MAX_EMAIL_LENGTH));

const newPasswordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, 'Use at least 8 characters.')
  .max(MAX_PASSWORD_LENGTH, 'Use at most 128 characters.')
  .regex(/[A-Za-z]/, 'Add at least one letter.')
  .regex(/\d/, 'Add at least one number.');

const displayNameField = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(MAX_DISPLAY_NAME_LENGTH, 'Use at most 50 characters.');

/** Validates email formatting and non-empty password credentials submitted during sign-in. */
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.').max(MAX_PASSWORD_LENGTH),
});

/** Enforces non-empty display names, valid email addresses, and complexity-checked passwords for new registrations. */
export const registerSchema = z.object({
  displayName: displayNameField,
  email: emailField,
  password: newPasswordField,
});

/** Verifies password complexity criteria and equality between password and confirmation fields on password reset. */
export const newPasswordSchema = z
  .object({ password: newPasswordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'The passwords are not the same.' });

/** First error message per field, for showing under each input. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return errors;
}
